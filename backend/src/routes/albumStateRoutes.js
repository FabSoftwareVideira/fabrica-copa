const express = require("express");
const { normalizePrestigeLevel, getPrestigeBonusMultiplier } = require("../utils/prestige");

const FORCE_REPEAT_PROBABILITY = 0.4; // Probabilidade de forçar repetida quando o usuário tem figurinhas faltando. Quanto mais alto, mais chance de sair repetida mesmo com figurinhas faltando. Ajuste conforme necessário.

function createAlbumStateRoutes({
    authMiddleware,
    STICKERS,
    STICKER_BY_ID,
    getAlbumState,
    getValidCollectedMap,
    nowSqlTimestamp,
    run,
    get,
    all,
    parseJSON,
    pickRandomWeighted,
    getAllTradeWindows,
    toTradeWindowsPayload,
    markAlbumCompletedIfNeeded,
}) {
    const router = express.Router();

    router.get("/stickers/catalog", async (_req, res) => {
        return res.json({ stickers: STICKERS, total: STICKERS.length });
    });

    router.get("/album/state", authMiddleware, async (req, res) => {
        try {
            const { state } = await getAlbumState(req.user.sub);
            const validCollected = await getValidCollectedMap(req.user.sub);
            const nowTimestamp = nowSqlTimestamp();
            await run(
                "UPDATE album_states SET collected_json = ?, updated_at = ? WHERE user_id = ?",
                [JSON.stringify(validCollected), nowTimestamp, req.user.sub]
            );
            await markAlbumCompletedIfNeeded(req.user.sub, validCollected);
            const allWindows = await getAllTradeWindows();
            const tradeWindows = toTradeWindowsPayload(allWindows);
            const prestigeLevel = normalizePrestigeLevel(state.prestigeLevel || 0);
            return res.json({
                ...state,
                collected: validCollected,
                tradeWindows,
                prestigeLevel,
                prestigeBonusMultiplier: getPrestigeBonusMultiplier(prestigeLevel),
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar estado", detail: err.message });
        }
    });

    router.put("/album/state", authMiddleware, async (req, res) => {
        try {
            const { row } = await getAlbumState(req.user.sub);
            const updatedAt = nowSqlTimestamp();
            const validatedCollected = await getValidCollectedMap(req.user.sub);

            await run(
                `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          trade_coins = ?,
          used_codes_json = ?,
          updated_at = ?
      WHERE user_id = ?
      `,
                [
                    JSON.stringify(validatedCollected),
                    row.packs_used_date || "",
                    row.packs_used_today || 0,
                    row.extra_packs || 0,
                    Number(row.trade_coins || 0),
                    row.used_codes_json || "[]",
                    updatedAt,
                    req.user.sub,
                ]
            );
            await markAlbumCompletedIfNeeded(req.user.sub, validatedCollected);

            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao salvar estado", detail: err.message });
        }
    });

    router.get("/system/events", authMiddleware, async (req, res) => {
        try {
            const sinceId = Math.max(0, Number(req.query.sinceId || 0));
            const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));

            const rows = await all(
                `SELECT id, event_type, message, payload_json, created_by_user_id, target_user_id, created_at
                 FROM system_events
                 WHERE id > ?
                   AND (target_user_id IS NULL OR target_user_id = ?)
                 ORDER BY id ASC
                 LIMIT ?`,
                [sinceId, req.user.sub, limit]
            );

            const events = rows.map((r) => ({
                id: r.id,
                type: r.event_type,
                message: r.message,
                payload: parseJSON(r.payload_json || "{}", {}),
                createdByUserId: r.created_by_user_id,
                targetUserId: r.target_user_id || null,
                createdAt: r.created_at,
            }));

            const lastEventId = events.length ? events[events.length - 1].id : sinceId;
            return res.json({ events, lastEventId });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar notificacoes", detail: err.message });
        }
    });

    router.post("/packs/open", authMiddleware, async (req, res) => {
        try {
            const { state } = await getAlbumState(req.user.sub);
            const available = Math.max(0, Number(state.extraPacks || 0));

            if (available <= 0) {
                return res.status(400).json({ error: "Sem pacotes disponíveis" });
            }

            // Gerar pacote considerando o estado atual do álbum
            const collectedMap = state.collected || {};
            // Separar figurinhas em faltantes e já coletadas
            const missing = STICKERS.filter((s) => (collectedMap[s.id] || 0) < 1);
            // Para aumentar a chance de repetidas, vamos considerar como "coletadas" as figurinhas que o usuário já tem pelo menos 1 exemplar.
            const collected = STICKERS.filter((s) => (collectedMap[s.id] || 0) >= 1);

            const pack = [];
            const wasOwned = [];

            for (let i = 0; i < 5; i++) {
                // Para aumentar a chance de repetidas, vamos usar uma abordagem ponderada.
                const forceRepeat = collected.length > 0 && (missing.length === 0 || Math.random() < FORCE_REPEAT_PROBABILITY);
                // Se for para forçar repetida, ou se não houver figurinhas faltando, escolhemos do pool de coletadas. Caso contrário, escolhemos do pool de faltantes.
                const pool = forceRepeat ? collected : (missing.length > 0 ? missing : STICKERS);
                const sticker = pickRandomWeighted(pool);
                // const sticker = pickRandomWeighted(STICKERS);
                pack.push(sticker);
                wasOwned.push((collectedMap[sticker.id] || 0) >= 1);
                collectedMap[sticker.id] = (collectedMap[sticker.id] || 0) + 1;
            }

            let nextExtraPacks = state.extraPacks || 0;
            let source = "bonus";
            nextExtraPacks = Math.max(0, nextExtraPacks - 1);

            const newCount = wasOwned.filter((x) => !x).length;
            const repeatCount = 5 - newCount;
            const nowTimestamp = nowSqlTimestamp();

            await run(
                `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          updated_at = ?
      WHERE user_id = ?
      `,
                [
                    JSON.stringify(collectedMap),
                    state.packsUsedDate || "",
                    state.packsUsedToday || 0,
                    nextExtraPacks,
                    nowTimestamp,
                    req.user.sub,
                ]
            );
            await markAlbumCompletedIfNeeded(req.user.sub, collectedMap);

            await run(
                "INSERT INTO pack_history(user_id, opened_at, stickers_json, new_count, repeat_count, source) VALUES(?, ?, ?, ?, ?, ?)",
                [req.user.sub, nowTimestamp, JSON.stringify(pack), newCount, repeatCount, source]
            );

            return res.json({
                ok: true,
                pack,
                wasOwned,
                state: {
                    collected: collectedMap,
                    packsUsedDate: state.packsUsedDate || "",
                    packsUsedToday: state.packsUsedToday || 0,
                    extraPacks: nextExtraPacks,
                    usedCodes: state.usedCodes,
                    prestigeLevel: normalizePrestigeLevel(state.prestigeLevel || 0),
                    prestigeBonusMultiplier: getPrestigeBonusMultiplier(state.prestigeLevel || 0),
                },
                summary: { newCount, repeatCount, source },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao abrir pacote", detail: err.message });
        }
    });

    router.post("/album/prestige/reset", authMiddleware, async (req, res) => {
        try {
            const { state } = await getAlbumState(req.user.sub);
            const validCollected = await getValidCollectedMap(req.user.sub);
            const totalStickers = Math.max(0, STICKERS.length);
            const collectedCount = Object.entries(validCollected).filter(
                ([stickerId, count]) => STICKER_BY_ID.has(String(stickerId)) && Number(count) >= 1
            ).length;

            if (totalStickers <= 0) {
                return res.status(400).json({ error: "Catálogo vazio. Não é possível ativar Prestígio agora." });
            }

            if (collectedCount < totalStickers) {
                return res.status(409).json({
                    error: "Prestígio disponível apenas após completar o álbum.",
                    collected: collectedCount,
                    total: totalStickers,
                });
            }

            const previousPrestigeLevel = normalizePrestigeLevel(state.prestigeLevel || 0);
            const nextPrestigeLevel = previousPrestigeLevel + 1;
            const nowTimestamp = nowSqlTimestamp();

            await run("DELETE FROM pack_history WHERE user_id = ?", [req.user.sub]);
            await run("DELETE FROM trade_history WHERE user_id = ?", [req.user.sub]);
            await run(
                `UPDATE trade_offers
                 SET status = 'cancelled', updated_at = ?
                 WHERE status = 'pending'
                   AND (from_user_id = ? OR to_user_id = ?)`,
                [nowTimestamp, req.user.sub, req.user.sub]
            );
            await run(
                `UPDATE album_states
                 SET collected_json = '{}',
                     completed_at = NULL,
                     prestige_level = ?,
                     last_prestige_at = ?,
                     updated_at = ?
                 WHERE user_id = ?`,
                [nextPrestigeLevel, nowTimestamp, nowTimestamp, req.user.sub]
            );

            const eventMessage = `${req.user.name} entrou no Prestigio ${nextPrestigeLevel} e reiniciou o álbum.`;
            const eventPayload = {
                userId: req.user.sub,
                userName: req.user.name,
                previousPrestigeLevel,
                prestigeLevel: nextPrestigeLevel,
                bonusMultiplier: getPrestigeBonusMultiplier(nextPrestigeLevel),
            };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('album_prestige_reset', ?, ?, ?, NULL, ?)`,
                [eventMessage, JSON.stringify(eventPayload), req.user.sub, nowTimestamp]
            );

            const row = await get(
                `SELECT collected_json, packs_used_date, packs_used_today, extra_packs, trade_coins,
                        used_codes_json, last_login_bonus_date, trade_reroll_count, trade_reroll_date,
                        completed_at, prestige_level, last_prestige_at
                 FROM album_states
                 WHERE user_id = ?`,
                [req.user.sub]
            );

            const prestigeLevel = normalizePrestigeLevel(row?.prestige_level || nextPrestigeLevel);
            return res.json({
                ok: true,
                prestigeLevel,
                prestigeBonusMultiplier: getPrestigeBonusMultiplier(prestigeLevel),
                message: `Prestígio ${prestigeLevel} ativado com sucesso!`,
                state: {
                    collected: parseJSON(row?.collected_json || "{}", {}),
                    packsUsedDate: row?.packs_used_date || "",
                    packsUsedToday: Number(row?.packs_used_today || 0),
                    extraPacks: Number(row?.extra_packs || 0),
                    tradeCoins: Number(row?.trade_coins || 0),
                    usedCodes: parseJSON(row?.used_codes_json || "[]", []),
                    lastLoginBonusDate: row?.last_login_bonus_date || "",
                    tradeRerollCount: Number(row?.trade_reroll_count || 0),
                    tradeRerollDate: row?.trade_reroll_date || "",
                    completedAt: row?.completed_at || "",
                    prestigeLevel,
                    lastPrestigeAt: row?.last_prestige_at || nowTimestamp,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao ativar Prestígio", detail: err.message });
        }
    });

    router.get("/packs/history", authMiddleware, async (req, res) => {
        try {
            const limit = Math.max(1, Math.min(50, Number(req.query.limit || 15)));
            const rows = await all(
                "SELECT id, opened_at, stickers_json, new_count, repeat_count, source FROM pack_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                [req.user.sub, limit]
            );

            const history = rows.map((r) => ({
                id: r.id,
                openedAt: r.opened_at,
                stickers: parseJSON(r.stickers_json || "[]", []),
                newCount: r.new_count,
                repeatCount: r.repeat_count,
                source: r.source,
            }));

            return res.json({ history });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar historico", detail: err.message });
        }
    });

    router.get("/stickers/:id", authMiddleware, async (req, res) => {
        const sticker = STICKER_BY_ID.get(req.params.id);
        if (!sticker) return res.status(404).json({ error: "Figurinha nao encontrada" });
        return res.json({ sticker });
    });

    return router;
}

module.exports = {
    createAlbumStateRoutes,
};
