"use strict";

/**
 * @param {object} deps
 * @param {Function} deps.run
 * @param {Function} deps.get
 * @param {Function} deps.all
 * @param {Map}      deps.STICKER_BY_ID
 * @param {Function} deps.parseJSON
 * @param {Function} deps.nowSqlTimestamp  – not used here but kept for symmetry if needed
 */
function createAlbumService({ run, get, all, STICKER_BY_ID, parseJSON }) {
    async function getAlbumState(userId) {
        let row = await get("SELECT * FROM album_states WHERE user_id = ?", [userId]);
        if (!row) {
            await run("INSERT INTO album_states(user_id) VALUES(?)", [userId]);
            row = await get("SELECT * FROM album_states WHERE user_id = ?", [userId]);
        }

        return {
            row,
            state: {
                collected: parseJSON(row.collected_json || "{}", {}),
                packsUsedDate: row.packs_used_date || "",
                packsUsedToday: row.packs_used_today || 0,
                extraPacks: row.extra_packs || 0,
                tradeCoins: Number(row.trade_coins || 0),
                usedCodes: parseJSON(row.used_codes_json || "[]", []),
            },
        };
    }

    /**
     * Rebuilds the collected-sticker map by replaying the user's full pack history.
     * This is the authoritative source of truth for owned stickers before trades.
     */
    async function rebuildCollectedFromPackHistory(userId) {
        const rows = await all(
            `SELECT stickers_json FROM pack_history WHERE user_id = ? ORDER BY id ASC`,
            [userId]
        );

        const collected = {};
        for (const row of rows) {
            const stickers = parseJSON(row.stickers_json || "[]", []);
            for (const sticker of stickers) {
                const stickerId = String(sticker?.id || "");
                if (!stickerId || !STICKER_BY_ID.has(stickerId)) continue;
                collected[stickerId] = (collected[stickerId] || 0) + 1;
            }
        }

        return collected;
    }

    /**
     * Returns the fully reconciled collected map after applying trade history on top
     * of the pack history baseline.
     */
    async function getValidCollectedMap(userId) {
        const collected = await rebuildCollectedFromPackHistory(userId);

        const tradeHistoryRows = await all(
            `SELECT offered_sticker_id, requested_sticker_id FROM trade_history WHERE user_id = ? ORDER BY id ASC`,
            [userId]
        );

        for (const trade of tradeHistoryRows) {
            const offeredId = String(trade.offered_sticker_id || "");
            const requestedId = String(trade.requested_sticker_id || "");

            if (offeredId && STICKER_BY_ID.has(offeredId)) {
                collected[offeredId] = Math.max(0, (collected[offeredId] || 0) - 1);
            }
            if (requestedId && STICKER_BY_ID.has(requestedId)) {
                collected[requestedId] = (collected[requestedId] || 0) + 1;
            }
        }

        return collected;
    }

    return { getAlbumState, rebuildCollectedFromPackHistory, getValidCollectedMap };
}

module.exports = { createAlbumService };