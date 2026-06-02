const express = require("express");

function createAlbumRoutes({
    authMiddleware,
    requireRoles,
    ROLE_ADMIN,
    APP_TIMEZONE,
    STICKERS,
    getGlobalRanking,
    getAllTradeWindows,
    toTradeWindowsPayload,
    run,
    get,
    nowSqlTimestamp,
}) {
    const router = express.Router();

    router.get("/ranking", async (req, res) => {
        try {
            const requestedLimit = Number(req.query?.limit || 10);
            const limit = Number.isFinite(requestedLimit)
                ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
                : 10;
            const ranking = await getGlobalRanking();

            return res.json({
                totalStickers: STICKERS.length,
                ranking: ranking.slice(0, limit).map((row) => ({
                    position: row.position,
                    userId: row.userId,
                    name: row.name,
                    collected: row.collected,
                    percent: row.percent,
                    completedAt: row.completedAt,
                    updatedAt: row.updatedAt,
                })),
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar ranking", detail: err.message });
        }
    });

    router.get("/ranking/me", authMiddleware, async (req, res) => {
        try {
            const ranking = await getGlobalRanking();
            const me = ranking.find((row) => Number(row.userId) === Number(req.user.sub));

            return res.json({
                totalStickers: STICKERS.length,
                position: me?.position || null,
                collected: me?.collected || 0,
                percent: me?.percent || 0,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar posição no ranking", detail: err.message });
        }
    });

    router.get("/trade/window", authMiddleware, async (_req, res) => {
        try {
            const allWindows = await getAllTradeWindows();
            const tradeWindows = toTradeWindowsPayload(allWindows);
            return res.json({ tradeWindows });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar janelas de trocas", detail: err.message });
        }
    });

    router.get("/admin/trade/windows", authMiddleware, requireRoles(ROLE_ADMIN), async (_req, res) => {
        try {
            const allWindows = await getAllTradeWindows();
            const tradeWindows = toTradeWindowsPayload(allWindows);
            return res.json({ tradeWindows });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar janelas de trocas", detail: err.message });
        }
    });

    // Rota para criar uma nova janela de trocas
    router.post("/admin/trade/windows", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const startsAtRaw = String(req.body?.startsAt || "").trim();
            const endsAtRaw = String(req.body?.endsAt || "").trim();

            if (!startsAtRaw || !endsAtRaw) {
                return res.status(400).json({ error: "Data/hora inicial e final são obrigatórias" });
            }

            const startsAtDate = new Date(startsAtRaw);
            const endsAtDate = new Date(endsAtRaw);
            if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
                return res.status(400).json({ error: "Data/hora de inicio ou fim inválida" });
            }

            const startsAt = startsAtDate.toISOString();
            const endsAt = endsAtDate.toISOString();
            if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
                return res.status(400).json({ error: "A data/hora final deve ser maior que a inicial" });
            }

            const createdAt = nowSqlTimestamp();
            const result = await run(
                `INSERT INTO trade_window_config(starts_at, ends_at, created_by_user_id, created_at, updated_at)
                 VALUES(?, ?, ?, ?, ?)`,
                [startsAt, endsAt, req.user.sub, createdAt, createdAt]
            );

            const allWindows = await getAllTradeWindows();
            const windows = toTradeWindowsPayload(allWindows);

            const startAtFormatted = new Date(startsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: APP_TIMEZONE });
            const endAtFormatted = new Date(endsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: APP_TIMEZONE });
            const eventMessage = `${req.user.name} criou uma janela de trocas de ${startAtFormatted} até ${endAtFormatted}.`;
            const eventPayload = {
                startsAt,
                endsAt,
                createdByUserId: req.user.sub,
                createdByName: req.user.name,
                windowId: result.lastID,
            };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('trade_window_created', ?, ?, ?, NULL, ?)`,
                [eventMessage, JSON.stringify(eventPayload), req.user.sub, createdAt]
            );

            return res.status(201).json({
                ok: true,
                tradeWindows: windows,
                message: "Janela de trocas criada",
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao criar janela de trocas", detail: err.message });
        }
    });

    router.delete("/admin/trade/windows/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const windowId = Number(req.params?.id || 0);
            if (!Number.isFinite(windowId) || windowId <= 0) {
                return res.status(400).json({ error: "ID da janela inválido" });
            }

            const row = await get(
                `SELECT id, starts_at, ends_at FROM trade_window_config WHERE id = ?`,
                [windowId]
            );

            if (!row) {
                return res.status(404).json({ error: "Janela de trocas não encontrada" });
            }

            await run(
                `DELETE FROM trade_window_config WHERE id = ?`,
                [windowId]
            );

            const allWindows = await getAllTradeWindows();
            const windows = toTradeWindowsPayload(allWindows);

            const eventMessage = `${req.user.name} removeu uma janela de trocas de ${row.starts_at} até ${row.ends_at}.`;
            const eventPayload = {
                windowId,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                deletedByUserId: req.user.sub,
                deletedByName: req.user.name,
            };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('trade_window_deleted', ?, ?, ?, NULL, ?)`,
                [eventMessage, JSON.stringify(eventPayload), req.user.sub, nowSqlTimestamp()]
            );

            return res.json({
                ok: true,
                tradeWindows: windows,
                message: "Janela de trocas removida",
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao remover janela de trocas", detail: err.message });
        }
    });

    return router;
}

module.exports = {
    createAlbumRoutes,
};
