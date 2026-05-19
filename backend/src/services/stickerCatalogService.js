const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createStickerCatalogService({
    dataScriptPath,
    uploadsRootDir,
    nowSqlTimestamp,
    all,
    logWarn,
}) {
    const uploadsLegacyCustomDir = path.join(uploadsRootDir, "custom-stickers");
    fs.mkdirSync(uploadsRootDir, { recursive: true });
    fs.mkdirSync(uploadsLegacyCustomDir, { recursive: true });

    function normalizeUploadedImagePath(rawValue) {
        const value = String(rawValue || "").trim();
        if (!value) return "";

        // Full HTTP URLs are stored as-is (they already include the API host)
        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        let normalized = value;
        if (!normalized.startsWith("/")) {
            normalized = `/${normalized}`;
        }

        if (normalized.startsWith("/api/uploads/")) {
            normalized = `/uploads/${normalized.slice("/api/uploads/".length)}`;
        }

        return normalized;
    }

    function loadFrontendCatalog() {
        try {
            const source = fs.readFileSync(dataScriptPath, "utf8");
            const sandbox = { window: {} };
            vm.runInNewContext(source, sandbox, { filename: "frontend/js/data.js" });

            const albumData = sandbox.window?.ALBUM_DATA;
            const allStickers = sandbox.window?.ALL_STICKERS;
            return {
                albumData: albumData && typeof albumData === "object" ? albumData : { groups: [] },
                stickers: Array.isArray(allStickers) ? allStickers : [],
            };
        } catch (err) {
            logWarn("Falha ao carregar catalogo do frontend", { err, dataScriptPath });
            return { albumData: { groups: [] }, stickers: [] };
        }
    }

    const { albumData: ALBUM_DATA, stickers: BASE_STICKERS } = loadFrontendCatalog();
    let CUSTOM_STICKERS = [];
    const STICKERS = [...BASE_STICKERS];
    const STICKER_BY_ID = new Map(STICKERS.map((s) => [String(s.id), s]));

    function getStickers() {
        return STICKERS;
    }

    function getStickerByIdMap() {
        return STICKER_BY_ID;
    }

    function getAlbumData() {
        return ALBUM_DATA;
    }

    function getCustomStickers() {
        return CUSTOM_STICKERS;
    }

    function setCustomStickers(nextCustomStickers) {
        CUSTOM_STICKERS = Array.isArray(nextCustomStickers) ? nextCustomStickers : [];
    }

    function normalizeSticker(sticker) {
        if (!sticker || typeof sticker !== "object") return null;
        const normalized = {
            id: String(sticker.id || "").trim(),
            num: Number(sticker.num || 0),
            name: String(sticker.name || "").trim(),
            icon: String(sticker.icon || "🎟️").trim() || "🎟️",
            section: String(sticker.section || (sticker.groupId ? `grupo-${sticker.groupId}` : "especial")),
            sectionName: String(sticker.sectionName || "Especial"),
            type: String(sticker.type || "custom"),
            teamId: sticker.teamId ? String(sticker.teamId) : null,
            teamName: sticker.teamName ? String(sticker.teamName) : null,
            teamImage: sticker.teamImage ? String(sticker.teamImage) : null,
            groupId: sticker.groupId ? String(sticker.groupId) : null,
            image: normalizeUploadedImagePath(sticker.image),
            createdAt: sticker.createdAt || nowSqlTimestamp(),
            createdByUserId: sticker.createdByUserId ? Number(sticker.createdByUserId) : null,
        };
        if (!normalized.id || !Number.isFinite(normalized.num) || normalized.num <= 0 || !normalized.name) {
            return null;
        }
        return normalized;
    }

    function rebuildStickerCatalog() {
        const nextCatalog = [...BASE_STICKERS, ...CUSTOM_STICKERS]
            .filter(Boolean)
            .sort((a, b) => Number(a.num || 0) - Number(b.num || 0));

        STICKERS.splice(0, STICKERS.length, ...nextCatalog);
        STICKER_BY_ID.clear();
        for (const sticker of STICKERS) {
            STICKER_BY_ID.set(String(sticker.id), sticker);
        }
    }

    async function loadCustomStickersFromDb() {
        const rows = await all(
            `SELECT id, num, name, icon, team_id, team_name, team_image, section_name, type, group_id, image, created_at, created_by_user_id
             FROM custom_stickers
             ORDER BY num ASC, created_at ASC`
        );
        CUSTOM_STICKERS = (Array.isArray(rows) ? rows : [])
            .map((row) => normalizeSticker({
                id: row.id,
                num: row.num,
                name: row.name,
                icon: row.icon,
                teamId: row.team_id,
                teamName: row.team_name,
                teamImage: row.team_image,
                sectionName: row.section_name,
                type: row.type,
                groupId: row.group_id,
                image: row.image,
                section: row.group_id ? `grupo-${row.group_id}` : "especial",
                createdAt: row.created_at,
                createdByUserId: row.created_by_user_id,
            }))
            .filter(Boolean);
        rebuildStickerCatalog();
    }

    function findTeamMeta(teamIdRaw) {
        const teamId = String(teamIdRaw || "").trim().toLowerCase();
        if (!teamId) return null;

        for (const group of Array.isArray(ALBUM_DATA.groups) ? ALBUM_DATA.groups : []) {
            for (const team of Array.isArray(group.teams) ? group.teams : []) {
                if (String(team.id || "").toLowerCase() === teamId) {
                    return {
                        teamId: team.id,
                        teamName: team.name,
                        teamImage: team.image || null,
                        groupId: group.id,
                        sectionName: group.name,
                    };
                }
            }
        }

        return null;
    }

    function saveStickerImageToUploads(rawImage, stickerId) {
        const imageValue = String(rawImage || "").trim();
        if (!imageValue) return "";
        if (imageValue.startsWith("/uploads/") || imageValue.startsWith("/api/uploads/") || /^https?:\/\//i.test(imageValue)) {
            return normalizeUploadedImagePath(imageValue);
        }
        if (!imageValue.startsWith("data:image/")) return normalizeUploadedImagePath(imageValue);

        const match = imageValue.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
        if (!match) throw new Error("Formato de imagem invalido");

        const ext = String(match[1] || "png").toLowerCase() === "jpeg"
            ? "jpg"
            : String(match[1] || "png").toLowerCase();
        const base64Content = match[2] || "";
        const fileName = `${stickerId}.${ext}`;
        const absPath = path.join(uploadsRootDir, fileName);
        fs.writeFileSync(absPath, Buffer.from(base64Content, "base64"));
        return `/uploads/${fileName}`;
    }

    function removeUploadedStickerImage(imagePath) {
        const clean = normalizeUploadedImagePath(imagePath);
        if (!clean.startsWith("/uploads/")) return;

        const fileName = path.basename(clean);
        const candidates = [
            path.join(uploadsRootDir, fileName),
            path.join(uploadsLegacyCustomDir, fileName),
        ];
        try {
            for (const absPath of candidates) {
                if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
            }
        } catch (_err) {
            // No-op: image may already be absent.
        }
    }

    return {
        getStickers,
        getStickerByIdMap,
        getAlbumData,
        getCustomStickers,
        setCustomStickers,
        normalizeSticker,
        rebuildStickerCatalog,
        loadCustomStickersFromDb,
        findTeamMeta,
        saveStickerImageToUploads,
        removeUploadedStickerImage,
    };
}

module.exports = {
    createStickerCatalogService,
};
