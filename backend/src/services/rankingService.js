"use strict";

/**
 * @param {object} deps
 * @param {Function} deps.all
 * @param {Array}    deps.STICKERS
 * @param {Map}      deps.STICKER_BY_ID
 * @param {Function} deps.parseJSON
 */
function createRankingService({ all, STICKERS, STICKER_BY_ID, parseJSON }) {
    function getTotalStickers() {
        return Math.max(0, STICKER_BY_ID.size);
    }

    function countCollectedStickers(collectedMap) {
        if (!collectedMap || typeof collectedMap !== "object") return 0;
        return Object.entries(collectedMap).reduce((acc, [stickerId, count]) => {
            if (!STICKER_BY_ID.has(String(stickerId))) return acc;
            return acc + (Number(count) >= 1 ? 1 : 0);
        }, 0);
    }

    /**
     * Maps raw DB rows to ranked entries with position, percent, and sort order.
     * Ties share the same position number.
     */
    function toRankingRows(rows) {
        const totalStickers = getTotalStickers();
        const ranked = (Array.isArray(rows) ? rows : [])
            .map((row) => {
                const collectedMap = parseJSON(row.collected_json || "{}", {});
                const collected = countCollectedStickers(collectedMap);
                const percent = totalStickers > 0
                    ? Math.min(100, Math.round((collected / totalStickers) * 100))
                    : 0;

                return {
                    userId: Number(row.id || 0),
                    name: String(row.name || "Usuário"),
                    collected,
                    percent,
                    completedAt: String(row.completed_at || ""),
                    updatedAt: String(row.updated_at || ""),
                };
            })
            .sort((a, b) => {
                if (b.collected !== a.collected) return b.collected - a.collected;

                const aIsComplete = totalStickers > 0 && a.collected >= totalStickers;
                const bIsComplete = totalStickers > 0 && b.collected >= totalStickers;
                if (aIsComplete && bIsComplete) {
                    if (a.completedAt && b.completedAt && a.completedAt !== b.completedAt) {
                        return a.completedAt.localeCompare(b.completedAt);
                    }
                    if (a.completedAt !== b.completedAt) {
                        return a.completedAt ? -1 : 1;
                    }
                }

                if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) {
                    return a.updatedAt.localeCompare(b.updatedAt);
                }
                return a.name.localeCompare(b.name, "pt-BR");
            });

        // Assign positions with tie-aware logic
        let lastCollected = null;
        let currentPosition = 0;
        for (let idx = 0; idx < ranked.length; idx++) {
            if (lastCollected === null || ranked[idx].collected !== lastCollected) {
                currentPosition = idx + 1;
                lastCollected = ranked[idx].collected;
            }
            ranked[idx].position = currentPosition;
        }

        return ranked;
    }

    async function getGlobalRanking() {
        const rows = await all(
            `SELECT u.id, u.name, u.is_blocked, a.collected_json, a.completed_at, a.updated_at
             FROM users u
             LEFT JOIN album_states a ON a.user_id = u.id
             WHERE u.is_blocked = 0`
        );
        return toRankingRows(rows);
    }

    return { countCollectedStickers, toRankingRows, getGlobalRanking };
}

module.exports = { createRankingService };