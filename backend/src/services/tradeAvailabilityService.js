const TRADE_AVAILABLE_LIMIT = 5;
const TRADE_AVAILABLE_REROLL_COST = 1;

function createTradeAvailabilityService({
    all,
    getValidCollectedMap,
    stickers,
}) {
    const tradeAvailableCache = new Map();

    function pickRandomItems(list, limit) {
        const items = Array.isArray(list) ? [...list] : [];
        for (let i = items.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items.slice(0, Math.max(0, Number(limit || 0)));
    }

    async function buildTradeAvailableEntries(userId) {
        const myCollected = await getValidCollectedMap(userId);
        const users = await all("SELECT id, name FROM users WHERE id != ? AND is_blocked = 0", [userId]);

        const pendingRows = await all(
            `SELECT from_user_id, offered_sticker_id, COUNT(*) AS pending_count
             FROM trade_offers
             WHERE status = 'pending'
             GROUP BY from_user_id, offered_sticker_id`
        );
        const pendingByUserSticker = new Map(
            pendingRows.map((r) => [
                `${Number(r.from_user_id)}:${String(r.offered_sticker_id)}`,
                Number(r.pending_count || 0),
            ])
        );

        const stickerOffers = new Map();

        for (const user of users) {
            const userCollected = await getValidCollectedMap(user.id);

            for (const sticker of stickers) {
                const userCount = Number(userCollected[sticker.id] || 0);
                const myCount = Number(myCollected[sticker.id] || 0);

                const reservedPending = Number(
                    pendingByUserSticker.get(`${Number(user.id)}:${String(sticker.id)}`) || 0
                );
                const tradableCount = Math.max(0, userCount - 1 - reservedPending);

                if (tradableCount > 0 && myCount < 1) {
                    if (!stickerOffers.has(sticker.id)) {
                        stickerOffers.set(sticker.id, { sticker, offeredBy: [] });
                    }
                    stickerOffers.get(sticker.id).offeredBy.push({
                        userId: user.id,
                        userName: user.name,
                        count: tradableCount,
                    });
                }
            }
        }

        return [...stickerOffers.values()].sort((a, b) => a.sticker.num - b.sticker.num);
    }

    function cloneTradeAvailableEntry(entry) {
        return {
            sticker: entry.sticker,
            offeredBy: Array.isArray(entry.offeredBy)
                ? entry.offeredBy.map((item) => ({ ...item }))
                : [],
        };
    }

    function pickTradeAvailableSelection(allAvailable, excludeStickerIds = []) {
        const excludeSet = new Set(
            (Array.isArray(excludeStickerIds) ? excludeStickerIds : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean)
        );

        const filtered = allAvailable.filter(
            (entry) => !excludeSet.has(String(entry?.sticker?.id || ""))
        );
        const source = filtered.length >= TRADE_AVAILABLE_LIMIT ? filtered : allAvailable;
        return pickRandomItems(source, TRADE_AVAILABLE_LIMIT);
    }

    function getCachedTradeAvailableSelection(userId, allAvailable) {
        const cacheKey = String(userId);
        const cached = tradeAvailableCache.get(cacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
            return cached.map(cloneTradeAvailableEntry);
        }

        const selection = pickTradeAvailableSelection(allAvailable);
        tradeAvailableCache.set(cacheKey, selection.map(cloneTradeAvailableEntry));
        return selection.map(cloneTradeAvailableEntry);
    }

    function setCachedTradeAvailableSelection(userId, available) {
        tradeAvailableCache.set(
            String(userId),
            (Array.isArray(available) ? available : []).map(cloneTradeAvailableEntry)
        );
    }

    return {
        TRADE_AVAILABLE_LIMIT,
        TRADE_AVAILABLE_REROLL_COST,
        buildTradeAvailableEntries,
        pickTradeAvailableSelection,
        getCachedTradeAvailableSelection,
        setCachedTradeAvailableSelection,
    };
}

module.exports = {
    createTradeAvailabilityService,
};
