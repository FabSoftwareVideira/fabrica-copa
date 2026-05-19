const crypto = require("crypto");
const express = require("express");

function createAdminRoutes({
    authMiddleware,
    requireRoles,
    ROLE_ADMIN,
    ROLE_SERVIDOR,
    ROLE_PLAYER,
    ALLOWED_ROLES,
    STICKERS,
    PROMO_CODES,
    run,
    get,
    all,
    nowSqlTimestamp,
    todayStr,
    normalizeCode,
    getAlbumState,
    sanitizeUser,
    findTeamMeta,
    saveStickerImageToUploads,
    removeUploadedStickerImage,
    normalizeSticker,
    rebuildStickerCatalog,
    getCustomStickers,
    setCustomStickers,
    API_BASE_URL,
}) {
    // Base URL for building full image URLs stored in DB (e.g. http://host/api)
    const apiBaseUrl = String(API_BASE_URL || "").replace(/\/+$/, "");
    const router = express.Router();

    router.post("/admin/coupons/grant-daily-pack", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const todayDate = todayStr();
            const users = await all(
                `SELECT id, name FROM users WHERE is_blocked = 0 AND role = ? OR role = ? OR role = ?`,
                [ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER]
            );
            let granted = 0;
            let skipped = 0;
            let errors = 0;
            for (const user of users) {
                try {
                    const alreadyToday = await get(
                        `SELECT id FROM user_coupons WHERE target_user_id = ? AND is_generic = 0 AND date(created_at) = ? LIMIT 1`,
                        [user.id, todayDate]
                    );
                    if (alreadyToday) {
                        skipped += 1;
                        continue;
                    }
                    const code = `BONUS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
                    const couponCreatedAt = nowSqlTimestamp();
                    await run(
                        `INSERT INTO user_coupons(code, target_user_id, created_by_user_id, packs_added, is_generic, status, created_at)
                         VALUES(?, ?, ?, 1, 0, 'active', ?)`,
                        [code, user.id, req.user.sub, couponCreatedAt]
                    );
                    const eventMessage = "Você recebeu 1 pacote de figurinhas do admin.";
                    const eventPayload = { code, packs: 1, createdByName: req.user.name, createdByRole: req.user.role };
                    await run(
                        `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                         VALUES('coupon_created', ?, ?, ?, ?, ?)`,
                        [eventMessage, JSON.stringify(eventPayload), req.user.sub, user.id, couponCreatedAt]
                    );
                    granted += 1;
                } catch (_err) {
                    errors += 1;
                }
            }
            return res.json({ ok: true, granted, skipped, errors, total: users.length });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao liberar pacotes", detail: err.message });
        }
    });

    router.post("/promo/redeem", authMiddleware, async (req, res) => {
        try {
            const code = normalizeCode(req.body?.code);
            if (!code) return res.status(400).json({ error: "Codigo obrigatorio" });

            let promo = PROMO_CODES[code];
            let isGeneratedCoupon = false;
            let couponRow = null;

            if (!promo) {
                couponRow = await get(
                    `SELECT id, packs_added, is_generic
                     FROM user_coupons
                     WHERE code = ? AND status = 'active'
                       AND (target_user_id = ? OR is_generic = 1)`,
                    [code, req.user.sub]
                );
                if (couponRow) {
                    promo = { packs: Number(couponRow.packs_added || 1), label: "Cupom de servidor/admin" };
                    isGeneratedCoupon = true;
                }
            }

            if (!promo) return res.status(400).json({ error: "Codigo invalido ou expirado" });

            if (!isGeneratedCoupon) {
                const already = await get("SELECT id FROM redeemed_codes WHERE user_id = ? AND code = ?", [req.user.sub, code]);
                if (already) return res.status(409).json({ error: "Este codigo ja foi resgatado" });
            }

            const { state } = await getAlbumState(req.user.sub);
            const usedCodes = Array.isArray(state.usedCodes) ? state.usedCodes : [];
            usedCodes.push(code);
            const extraPacks = (state.extraPacks || 0) + promo.packs;

            if (isGeneratedCoupon && couponRow) {
                const redeemResult = await run(
                    "UPDATE user_coupons SET status = 'redeemed', redeemed_at = ?, redeemed_by_user_id = ? WHERE id = ? AND status = 'active'",
                    [nowSqlTimestamp(), req.user.sub, couponRow.id]
                );
                if (!redeemResult || Number(redeemResult.changes || 0) !== 1) {
                    return res.status(409).json({ error: "Este cupom ja foi resgatado" });
                }
            } else {
                await run("INSERT INTO redeemed_codes(user_id, code, packs_added) VALUES(?, ?, ?)", [
                    req.user.sub,
                    code,
                    promo.packs,
                ]);
            }

            await run(
                `
          UPDATE album_states
            SET extra_packs = ?, used_codes_json = ?, updated_at = ?
          WHERE user_id = ?
          `,
                [extraPacks, JSON.stringify(usedCodes), nowSqlTimestamp(), req.user.sub]
            );

            return res.json({
                ok: true,
                code,
                packs: promo.packs,
                label: promo.label,
                extraPacks,
                usedCodes,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao resgatar codigo", detail: err.message });
        }
    });

    router.get("/coupons/targets", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_SERVIDOR), async (req, res) => {
        try {
            const users = await all(
                `SELECT id, name, email, role, is_blocked
                 FROM users
                 WHERE id != ?
                 ORDER BY name ASC`,
                [req.user.sub]
            );
            return res.json({ users: users.map(sanitizeUser) });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar usuarios", detail: err.message });
        }
    });

    router.post("/coupons/generate", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_SERVIDOR), async (req, res) => {
        try {
            const targetUserId = Number(req.body?.targetUserId || 0);
            const hasTargetUser = targetUserId > 0;
            if (!hasTargetUser && req.user.role !== ROLE_ADMIN) {
                return res.status(403).json({ error: "Somente administradores podem gerar cupom livre" });
            }
            if (hasTargetUser && targetUserId === req.user.sub) {
                return res.status(400).json({ error: "Nao pode gerar cupom para si mesmo" });
            }

            let targetUser = null;
            if (hasTargetUser) {
                targetUser = await get("SELECT id, name, is_blocked FROM users WHERE id = ?", [targetUserId]);
                if (!targetUser) return res.status(404).json({ error: "Usuario alvo nao encontrado" });
                if (Number(targetUser.is_blocked || 0) === 1) {
                    return res.status(400).json({ error: "Nao e possivel gerar cupom para usuario bloqueado" });
                }
            }

            const requestedPacks = Number(req.body?.packs || 1);
            const packs = req.user.role === ROLE_ADMIN
                ? Math.max(1, Number.isFinite(requestedPacks) ? requestedPacks : 1)
                : Math.max(1, Math.min(3, Number.isFinite(requestedPacks) ? requestedPacks : 1));
            const isGeneric = hasTargetUser ? 0 : 1;
            const couponTargetUserId = hasTargetUser ? targetUserId : req.user.sub;
            const todayDate = todayStr();

            if (hasTargetUser) {
                const alreadyToday = await get(
                    `SELECT id FROM user_coupons
                     WHERE target_user_id = ? AND is_generic = 0 AND date(created_at) = ?
                     LIMIT 1`,
                    [targetUserId, todayDate]
                );
                if (alreadyToday) {
                    return res.status(409).json({ error: "Ja foi gerado um cupom para este usuario hoje" });
                }
            }

            const code = `BONUS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

            const couponCreatedAt = nowSqlTimestamp();
            let insertResult = null;

            if (hasTargetUser) {
                insertResult = await run(
                    `INSERT INTO user_coupons(code, target_user_id, created_by_user_id, packs_added, is_generic, status, created_at)
                     SELECT ?, ?, ?, ?, 0, 'active', ?
                     WHERE NOT EXISTS (
                        SELECT 1 FROM user_coupons
                        WHERE target_user_id = ? AND is_generic = 0 AND date(created_at) = ?
                     )`,
                    [
                        code,
                        couponTargetUserId,
                        req.user.sub,
                        packs,
                        couponCreatedAt,
                        couponTargetUserId,
                        todayDate,
                    ]
                );

                if (!insertResult || Number(insertResult.changes || 0) !== 1) {
                    return res.status(409).json({ error: "Ja foi gerado um cupom para este usuario hoje" });
                }
            } else {
                insertResult = await run(
                    `INSERT INTO user_coupons(code, target_user_id, created_by_user_id, packs_added, is_generic, status, created_at)
                     VALUES(?, ?, ?, ?, ?, 'active', ?)`,
                    [code, couponTargetUserId, req.user.sub, packs, isGeneric, couponCreatedAt]
                );
            }

            if (hasTargetUser) {
                const eventMessage = `Você recebeu um cupom de ${packs} pacote(s) de ${req.user.name}.`;
                const eventPayload = { code, packs, createdByName: req.user.name, createdByRole: req.user.role };
                await run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('coupon_created', ?, ?, ?, ?, ?)`,
                    [eventMessage, JSON.stringify(eventPayload), req.user.sub, targetUserId, couponCreatedAt]
                );
            }

            return res.status(201).json({
                ok: true,
                coupon: {
                    code,
                    targetUserId: hasTargetUser ? targetUserId : null,
                    targetUserName: hasTargetUser ? targetUser?.name : "qualquer usuário",
                    isGeneric: isGeneric === 1,
                    packs,
                    createdByRole: req.user.role,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao gerar cupom", detail: err.message });
        }
    });

    router.get("/admin/coupons", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_SERVIDOR), async (req, res) => {
        try {
            const isAdmin = req.user?.role === ROLE_ADMIN;
            const whereClause = isAdmin ? "" : "WHERE c.created_by_user_id = ?";
            const params = isAdmin ? [] : [req.user.sub];
            const coupons = await all(
                `SELECT c.id, c.code, c.packs_added, c.is_generic, c.status, c.created_at, c.redeemed_at,
                        c.target_user_id, c.created_by_user_id, c.redeemed_by_user_id,
                        tu.name AS target_user_name,
                        cu.name AS created_by_user_name,
                        ru.name AS redeemed_by_user_name
                 FROM user_coupons c
                 LEFT JOIN users tu ON tu.id = c.target_user_id
                 LEFT JOIN users cu ON cu.id = c.created_by_user_id
                 LEFT JOIN users ru ON ru.id = c.redeemed_by_user_id
                 ${whereClause}
                 ORDER BY c.created_at DESC, c.id DESC`,
                params
            );

            return res.json({
                coupons: coupons.map((c) => ({
                    id: c.id,
                    code: c.code,
                    packs: Number(c.packs_added || 1),
                    isGeneric: Number(c.is_generic || 0) === 1,
                    status: c.status || "active",
                    createdAt: c.created_at,
                    redeemedAt: c.redeemed_at,
                    targetUserId: c.target_user_id,
                    targetUserName: c.target_user_name || null,
                    createdByUserId: c.created_by_user_id,
                    createdByUserName: c.created_by_user_name || null,
                    redeemedByUserId: c.redeemed_by_user_id || null,
                    redeemedByUserName: c.redeemed_by_user_name || null,
                })),
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar cupons", detail: err.message });
        }
    });

    router.delete("/admin/coupons/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const couponId = Number(req.params.id || 0);
            if (!couponId) return res.status(400).json({ error: "id invalido" });

            const coupon = await get(
                `SELECT id, code, status
                 FROM user_coupons
                 WHERE id = ?`,
                [couponId]
            );
            if (!coupon) return res.status(404).json({ error: "Cupom nao encontrado" });

            await run("DELETE FROM user_coupons WHERE id = ?", [couponId]);

            return res.json({
                ok: true,
                deletedCoupon: {
                    id: coupon.id,
                    code: coupon.code,
                    status: coupon.status,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao excluir cupom", detail: err.message });
        }
    });

    router.get("/admin/users", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const users = await all(
                `SELECT id, name, email, role, is_blocked, blocked_reason, created_at
                 FROM users
                 ORDER BY id ASC`
            );
            return res.json({
                users: users.map((u) => ({
                    ...sanitizeUser(u),
                    blockedReason: u.blocked_reason || "",
                    createdAt: u.created_at,
                })),
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar usuarios", detail: err.message });
        }
    });

    router.put("/admin/users/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const userId = Number(req.params.id || 0);
            if (!userId) return res.status(400).json({ error: "id invalido" });

            const target = await get("SELECT id, role, is_blocked FROM users WHERE id = ?", [userId]);
            if (!target) return res.status(404).json({ error: "Usuario nao encontrado" });

            if (userId === req.user.sub && req.body?.role && req.body.role !== ROLE_ADMIN) {
                return res.status(400).json({ error: "Admin nao pode remover seu proprio papel admin" });
            }
            if (userId === req.user.sub && Number(req.body?.isBlocked) === 1) {
                return res.status(400).json({ error: "Admin nao pode bloquear a si mesmo" });
            }

            const nextRole = req.body?.role ? String(req.body.role) : target.role;
            if (!ALLOWED_ROLES.has(nextRole)) {
                return res.status(400).json({ error: "Perfil invalido" });
            }

            const nextBlocked = req.body?.isBlocked === undefined
                ? Number(target.is_blocked || 0)
                : Number(req.body.isBlocked ? 1 : 0);

            const blockedReason = nextBlocked ? String(req.body?.blockedReason || "Bloqueado pelo administrador").trim() : "";

            await run(
                "UPDATE users SET role = ?, is_blocked = ?, blocked_reason = ? WHERE id = ?",
                [nextRole, nextBlocked, blockedReason, userId]
            );

            const updated = await get(
                "SELECT id, name, email, role, is_blocked, blocked_reason, created_at FROM users WHERE id = ?",
                [userId]
            );

            return res.json({
                ok: true,
                user: {
                    ...sanitizeUser(updated),
                    blockedReason: updated.blocked_reason || "",
                    createdAt: updated.created_at,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao atualizar usuario", detail: err.message });
        }
    });

    router.put("/admin/users/:id/password", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const userId = Number(req.params.id || 0);
            const password = String(req.body?.password || "");
            if (!userId) return res.status(400).json({ error: "id invalido" });
            if (password.length < 6) return res.status(400).json({ error: "Senha deve ter 6+ caracteres" });

            const target = await get("SELECT id FROM users WHERE id = ?", [userId]);
            if (!target) return res.status(404).json({ error: "Usuario nao encontrado" });

            await run("UPDATE users SET password_hash = ? WHERE id = ?", [await require("bcryptjs").hash(password, 10), userId]);

            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao alterar senha", detail: err.message });
        }
    });

    router.post("/admin/stickers", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const name = String(req.body?.name || "").trim();
            const icon = String(req.body?.icon || "🎟️").trim() || "🎟️";
            const type = String(req.body?.type || "custom").trim() || "custom";
            const rawImage = String(req.body?.image || "").trim();
            const teamIdRaw = String(req.body?.teamId || "").trim();

            if (rawImage.startsWith("data:image/") && rawImage.length > 7_000_000) {
                return res.status(400).json({ error: "Imagem muito grande. Use uma imagem menor que 5MB." });
            }

            if (name.length < 2) {
                return res.status(400).json({ error: "Nome da figurinha invalido" });
            }

            const teamMeta = teamIdRaw ? findTeamMeta(teamIdRaw) : null;
            if (teamIdRaw && !teamMeta) {
                return res.status(400).json({ error: "Time invalido para esta figurinha" });
            }

            const maxNumRow = await get("SELECT MAX(num) AS maxNum FROM custom_stickers");
            const baseMaxNum = STICKERS.reduce((acc, s) => Math.max(acc, Number(s.num || 0)), 0);
            const nextNum = Math.max(Number(maxNumRow?.maxNum || 0), baseMaxNum) + 1;
            const stickerId = `custom-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
            const createdAt = nowSqlTimestamp();
            let image = "";
            try {
                const relativePath = saveStickerImageToUploads(rawImage, stickerId);
                // Store full URL in DB so it works across environments
                image = relativePath && apiBaseUrl ? `${apiBaseUrl}${relativePath}` : relativePath;
            } catch {
                return res.status(400).json({ error: "Falha ao processar a imagem enviada" });
            }

            const sectionName = teamMeta ? teamMeta.sectionName : "Especial";
            const groupId = teamMeta ? teamMeta.groupId : null;
            const teamId = teamMeta ? teamMeta.teamId : null;
            const teamName = teamMeta ? teamMeta.teamName : null;
            const teamImage = teamMeta ? teamMeta.teamImage : null;

            await run(
                `INSERT INTO custom_stickers(
                    id, num, name, icon, team_id, team_name, team_image, section_name, type, group_id, image, created_by_user_id, created_at
                 )
                 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    stickerId,
                    nextNum,
                    name,
                    icon,
                    teamId,
                    teamName,
                    teamImage,
                    sectionName,
                    type,
                    groupId,
                    image,
                    req.user.sub,
                    createdAt,
                ]
            );

            const sticker = normalizeSticker({
                id: stickerId,
                num: nextNum,
                name,
                icon,
                teamId,
                teamName,
                teamImage,
                sectionName,
                type,
                groupId,
                image,
                section: groupId ? `grupo-${groupId}` : "especial",
                createdAt,
                createdByUserId: req.user.sub,
            });

            const updatedCustomStickers = [...getCustomStickers(), sticker];
            setCustomStickers(updatedCustomStickers);
            rebuildStickerCatalog();

            const eventPayload = {
                stickerId: sticker.id,
                stickerName: sticker.name,
                num: sticker.num,
                icon: sticker.icon,
                image: sticker.image,
                type: sticker.type,
                teamId: sticker.teamId,
                teamName: sticker.teamName,
                groupId: sticker.groupId,
                sectionName: sticker.sectionName,
                teamImage: sticker.teamImage,
                createdByName: req.user.name,
            };
            const message = `${req.user.name} criou a figurinha #${sticker.num} (${sticker.name})`;

            const eventInsert = await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, created_at)
                 VALUES('sticker_created', ?, ?, ?, ?)`,
                [message, JSON.stringify(eventPayload), req.user.sub, createdAt]
            );

            return res.status(201).json({
                ok: true,
                sticker,
                event: {
                    id: eventInsert.lastID,
                    type: "sticker_created",
                    message,
                    payload: eventPayload,
                    createdAt,
                    createdByUserId: req.user.sub,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao criar figurinha", detail: err.message });
        }
    });

    router.get("/admin/stickers/recent", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_SERVIDOR), async (req, res) => {
        try {
            const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
            const rows = await all(
                `SELECT cs.id, cs.num, cs.name, cs.icon, cs.team_id, cs.team_name, cs.team_image, cs.section_name, cs.type, cs.group_id, cs.image, cs.created_at, cs.created_by_user_id,
                        u.name AS created_by_user_name
                 FROM custom_stickers cs
                 LEFT JOIN users u ON u.id = cs.created_by_user_id
                 ORDER BY cs.created_at DESC
                 LIMIT ?`,
                [limit]
            );

            const stickers = rows.map((r) => ({
                id: r.id,
                num: Number(r.num),
                name: r.name,
                icon: r.icon,
                teamId: r.team_id,
                teamName: r.team_name,
                teamImage: r.team_image,
                sectionName: r.section_name,
                type: r.type,
                groupId: r.group_id,
                image: r.image,
                section: r.group_id ? `grupo-${r.group_id}` : "especial",
                createdAt: r.created_at,
                createdByUserId: r.created_by_user_id,
                createdByUserName: r.created_by_user_name || "Admin",
            }));

            return res.json({ stickers });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar figurinhas criadas", detail: err.message });
        }
    });

    router.put("/admin/stickers/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const stickerId = String(req.params.id || "").trim();
            if (!stickerId) return res.status(400).json({ error: "ID invalido" });

            const existing = await get(
                `SELECT id, num, name, icon, team_id, team_name, team_image, section_name, type, group_id, image, created_at, created_by_user_id
                 FROM custom_stickers
                 WHERE id = ?`,
                [stickerId]
            );
            if (!existing) return res.status(404).json({ error: "Figurinha nao encontrada" });

            const name = String(req.body?.name || existing.name || "").trim();
            const icon = String(req.body?.icon || existing.icon || "🎟️").trim() || "🎟️";
            const type = String(req.body?.type || existing.type || "custom").trim() || "custom";
            const teamIdRaw = String(req.body?.teamId || "").trim();
            const hasImageField = typeof req.body?.image === "string";
            const rawImage = hasImageField ? String(req.body?.image || "").trim() : null;

            if (name.length < 2) {
                return res.status(400).json({ error: "Nome da figurinha invalido" });
            }

            if (rawImage && rawImage.startsWith("data:image/") && rawImage.length > 7_000_000) {
                return res.status(400).json({ error: "Imagem muito grande. Use uma imagem menor que 5MB." });
            }

            const teamMeta = teamIdRaw ? findTeamMeta(teamIdRaw) : null;
            if (teamIdRaw && !teamMeta) {
                return res.status(400).json({ error: "Time invalido para esta figurinha" });
            }

            let image = existing.image || "";
            if (hasImageField) {
                if (!rawImage) {
                    image = "";
                } else {
                    try {
                        const relativePath = saveStickerImageToUploads(rawImage, stickerId);
                        // Store full URL in DB so it works across environments
                        image = relativePath && apiBaseUrl ? `${apiBaseUrl}${relativePath}` : relativePath;
                    } catch {
                        return res.status(400).json({ error: "Falha ao processar a imagem enviada" });
                    }
                }
            }

            const sectionName = teamMeta ? teamMeta.sectionName : "Especial";
            const groupId = teamMeta ? teamMeta.groupId : null;
            const teamId = teamMeta ? teamMeta.teamId : null;
            const teamName = teamMeta ? teamMeta.teamName : null;
            const teamImage = teamMeta ? teamMeta.teamImage : null;

            await run(
                `UPDATE custom_stickers
                 SET name = ?, icon = ?, team_id = ?, team_name = ?, team_image = ?, section_name = ?, type = ?, group_id = ?, image = ?
                 WHERE id = ?`,
                [
                    name,
                    icon,
                    teamId,
                    teamName,
                    teamImage,
                    sectionName,
                    type,
                    groupId,
                    image,
                    stickerId,
                ]
            );

            if (hasImageField && existing.image && image !== existing.image) {
                removeUploadedStickerImage(existing.image);
            }

            const sticker = normalizeSticker({
                id: stickerId,
                num: existing.num,
                name,
                icon,
                teamId,
                teamName,
                teamImage,
                sectionName,
                type,
                groupId,
                image,
                section: groupId ? `grupo-${groupId}` : "especial",
                createdAt: existing.created_at,
                createdByUserId: existing.created_by_user_id,
            });

            const updatedCustomStickers = getCustomStickers().map((item) =>
                item.id === stickerId ? sticker : item
            );
            setCustomStickers(updatedCustomStickers);
            rebuildStickerCatalog();

            const updatedAt = nowSqlTimestamp();
            const message = `${req.user.name} editou a figurinha #${existing.num} (${name})`;
            const eventPayload = {
                stickerId,
                num: existing.num,
                stickerName: name,
                icon,
                image,
                type,
                teamId,
                teamName,
                sectionName,
                groupId,
                editedByName: req.user.name,
            };
            const eventInsert = await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, created_at)
                 VALUES('sticker_updated', ?, ?, ?, ?)`,
                [message, JSON.stringify(eventPayload), req.user.sub, updatedAt]
            );

            return res.json({
                ok: true,
                sticker,
                event: {
                    id: eventInsert.lastID,
                    type: "sticker_updated",
                    message,
                    payload: eventPayload,
                    createdAt: updatedAt,
                    createdByUserId: req.user.sub,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao atualizar figurinha", detail: err.message });
        }
    });

    router.delete("/admin/stickers/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const stickerId = String(req.params.id || "").trim();
            if (!stickerId) return res.status(400).json({ error: "ID invalido" });

            const existing = await get("SELECT id, num, name, image FROM custom_stickers WHERE id = ?", [stickerId]);
            if (!existing) return res.status(404).json({ error: "Figurinha nao encontrada" });

            await run("DELETE FROM custom_stickers WHERE id = ?", [stickerId]);
            removeUploadedStickerImage(existing.image);

            const updatedCustomStickers = getCustomStickers().filter((s) => s.id !== stickerId);
            setCustomStickers(updatedCustomStickers);
            rebuildStickerCatalog();

            const message = `${req.user.name} removeu a figurinha #${existing.num} (${existing.name})`;
            const deletedAt = nowSqlTimestamp();
            const eventInsert = await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, created_at)
                 VALUES('sticker_deleted', ?, ?, ?, ?)`,
                [message, JSON.stringify({ stickerId, num: existing.num, stickerName: existing.name, createdByName: req.user.name }), req.user.sub, deletedAt]
            );

            return res.json({
                ok: true,
                stickerId,
                event: { id: eventInsert.lastID, type: "sticker_deleted", message, createdAt: deletedAt },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao excluir figurinha", detail: err.message });
        }
    });

    return router;
}

module.exports = {
    createAdminRoutes,
};
