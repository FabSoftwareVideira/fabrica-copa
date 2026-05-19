"use strict";

/**
 * @param {object} deps
 * @param {Function} deps.all
 */
function createTradeWindowService({ all }) {
    async function getAllTradeWindows() {
        const rows = await all(
            `SELECT tw.id, tw.starts_at, tw.ends_at, tw.created_by_user_id, tw.created_at, tw.updated_at,
                    u.name as created_by_user_name
             FROM trade_window_config tw
             LEFT JOIN users u ON u.id = tw.created_by_user_id
             ORDER BY tw.starts_at ASC`
        );
        return Array.isArray(rows) ? rows : [];
    }

    function toTradeWindowRowPayload(row) {
        if (!row || !row.starts_at || !row.ends_at) return null;

        const startMs = new Date(row.starts_at).getTime();
        const endMs = new Date(row.ends_at).getTime();
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

        const nowMs = Date.now();

        return {
            id: row.id,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            isOpen: nowMs >= startMs && nowMs <= endMs,
            createdByUserId: row.created_by_user_id,
            createdByUserName: row.created_by_user_name || "Admin",
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function toTradeWindowsPayload(rows) {
        if (!Array.isArray(rows)) return [];
        return rows.map((r) => toTradeWindowRowPayload(r)).filter(Boolean);
    }

    function isAnyTradeWindowOpen(windows) {
        if (!Array.isArray(windows)) return false;
        return windows.some((w) => w?.isOpen === true);
    }

    function createRequireTradeWindowOpen() {
        return async function requireTradeWindowOpen(req, res, next) {
            try {
                const allWindows = await getAllTradeWindows();
                const windows = toTradeWindowsPayload(allWindows);
                if (!isAnyTradeWindowOpen(windows)) {
                    return res.status(403).json({
                        error: "A janela de trocas esta fechada no momento",
                        code: "TRADE_WINDOW_CLOSED",
                        tradeWindows: windows,
                    });
                }
                req.tradeWindows = windows;
                return next();
            } catch (err) {
                return res.status(500).json({ error: "Erro ao validar janela de trocas", detail: err.message });
            }
        };
    }

    return {
        getAllTradeWindows,
        toTradeWindowRowPayload,
        toTradeWindowsPayload,
        isAnyTradeWindowOpen,
        requireTradeWindowOpen: createRequireTradeWindowOpen(),
    };
}

module.exports = { createTradeWindowService };