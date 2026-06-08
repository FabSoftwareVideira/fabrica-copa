const express = require("express");

function normalizeText(value) {
    return String(value || "").trim();
}

function parseMatchPayload(body = {}) {
    const homeTeam = normalizeText(body.homeTeam || body.home_team);
    const awayTeam = normalizeText(body.awayTeam || body.away_team);
    const matchDatetime = normalizeText(body.matchDatetime || body.match_datetime);

    const parseGoal = (raw) => {
        if (raw === "" || raw == null) return null;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) return NaN;
        return n;
    };

    const homeGoals = parseGoal(body.homeGoals ?? body.home_goals);
    const awayGoals = parseGoal(body.awayGoals ?? body.away_goals);

    return { homeTeam, awayTeam, matchDatetime, homeGoals, awayGoals };
}

function parsePositiveId(rawId) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return 0;
    return id;
}

function parseScore(rawValue) {
    const n = Number(rawValue);
    if (!Number.isInteger(n) || n < 0 || n > 99) return NaN;
    return n;
}

function matchOutcome(homeGoals, awayGoals) {
    if (homeGoals === awayGoals) return "draw";
    return homeGoals > awayGoals ? "home" : "away";
}

function evaluatePredictionReward({ predictedHomeGoals, predictedAwayGoals, actualHomeGoals, actualAwayGoals }) {
    if (actualHomeGoals == null || actualAwayGoals == null) {
        return {
            badgeKey: "pending",
            badgeLabel: "Em processamento",
            rewardCoins: 0,
            resolved: false,
        };
    }

    if (predictedHomeGoals === actualHomeGoals && predictedAwayGoals === actualAwayGoals) {
        return {
            badgeKey: "exact",
            badgeLabel: "Cravou placar",
            rewardCoins: 5,
            resolved: true,
        };
    }

    if (matchOutcome(predictedHomeGoals, predictedAwayGoals) === matchOutcome(actualHomeGoals, actualAwayGoals)) {
        return {
            badgeKey: "winner",
            badgeLabel: "Acertou vencedor",
            rewardCoins: 3,
            resolved: true,
        };
    }

    if (predictedHomeGoals === actualHomeGoals || predictedAwayGoals === actualAwayGoals) {
        return {
            badgeKey: "one-team-goals",
            badgeLabel: "Acertou gols de um time",
            rewardCoins: 1,
            resolved: true,
        };
    }

    return {
        badgeKey: "miss",
        badgeLabel: "Sem premiação",
        rewardCoins: 0,
        resolved: true,
    };
}

function createMatchRoutes({ authMiddleware, requireRoles, ROLE_ADMIN, all, get, run, transaction, nowSqlTimestamp }) {
    const router = express.Router();

    const claimPredictionRewardsTx = transaction((userId, claimedAt) => {
        const rows = all(
            `SELECT mp.id,
                    mp.home_goals,
                    mp.away_goals,
                    mp.reward_claimed_at,
                    m.home_goals AS match_home_goals,
                    m.away_goals AS match_away_goals
             FROM match_predictions mp
             JOIN matches m ON m.id = mp.match_id
             WHERE mp.user_id = ?
               AND mp.reward_claimed_at IS NULL
               AND m.home_goals IS NOT NULL
               AND m.away_goals IS NOT NULL`,
            [userId],
        );

        let awardedCoins = 0;
        let claimedCount = 0;

        for (const row of rows) {
            const reward = evaluatePredictionReward({
                predictedHomeGoals: Number(row.home_goals),
                predictedAwayGoals: Number(row.away_goals),
                actualHomeGoals: Number(row.match_home_goals),
                actualAwayGoals: Number(row.match_away_goals),
            });

            if (!reward.resolved || reward.rewardCoins <= 0) continue;

            const updateResult = run(
                `UPDATE match_predictions
                 SET reward_claimed_at = ?,
                     reward_claimed_coins = ?,
                     updated_at = ?
                 WHERE id = ?
                   AND user_id = ?
                   AND reward_claimed_at IS NULL`,
                [claimedAt, reward.rewardCoins, claimedAt, row.id, userId],
            );

            if (Number(updateResult?.changes || 0) === 1) {
                awardedCoins += reward.rewardCoins;
                claimedCount += 1;
            }
        }

        if (awardedCoins > 0) {
            run("INSERT OR IGNORE INTO album_states(user_id) VALUES(?)", [userId]);
            run(
                `UPDATE album_states
                 SET trade_coins = trade_coins + ?,
                     updated_at = ?
                 WHERE user_id = ?`,
                [awardedCoins, claimedAt, userId],
            );
        }

        const coinsRow = get("SELECT trade_coins FROM album_states WHERE user_id = ?", [userId]);

        return {
            awardedCoins,
            claimedCount,
            tradeCoins: Number(coinsRow?.trade_coins || 0),
        };
    });

    router.get("/matches", authMiddleware, async (_req, res) => {
        try {
            const rows = await all(
                `SELECT id, home_team, away_team, match_datetime, home_goals, away_goals
                 FROM matches
                 ORDER BY match_datetime ASC, id ASC`
            );

            const matches = rows.map((row) => ({
                id: row.id,
                homeTeam: row.home_team,
                awayTeam: row.away_team,
                matchDatetime: row.match_datetime,
                homeGoals: row.home_goals == null ? null : Number(row.home_goals),
                awayGoals: row.away_goals == null ? null : Number(row.away_goals),
            }));

            return res.json({ matches });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar partidas", detail: err.message });
        }
    });

    router.get("/matches/predictions/available", authMiddleware, async (req, res) => {
        try {
            const rows = await all(
                `SELECT m.id, m.home_team, m.away_team, m.match_datetime
                 FROM matches m
                 LEFT JOIN match_predictions mp
                   ON mp.match_id = m.id
                  AND mp.user_id = ?
                 WHERE mp.id IS NULL
                 ORDER BY m.match_datetime ASC, m.id ASC`,
                [req.user.sub],
            );

            const now = Date.now();
            const matches = rows
                .map((row) => {
                    const kickoffMs = new Date(row.match_datetime).getTime();
                    const deadlineMs = kickoffMs - (3 * 60 * 60 * 1000);
                    return {
                        id: row.id,
                        homeTeam: row.home_team,
                        awayTeam: row.away_team,
                        matchDatetime: row.match_datetime,
                        predictionDeadline: Number.isFinite(deadlineMs)
                            ? new Date(deadlineMs).toISOString()
                            : null,
                        canPredict: Number.isFinite(deadlineMs) && now <= deadlineMs,
                    };
                })
                .filter((item) => item.canPredict);

            return res.json({ matches });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar partidas aptas para palpite", detail: err.message });
        }
    });

    router.get("/matches/predictions/mine", authMiddleware, async (req, res) => {
        try {
            const rows = await all(
                `SELECT mp.id,
                        mp.match_id,
                        mp.home_goals,
                        mp.away_goals,
                        mp.created_at,
                        mp.reward_claimed_at,
                        mp.reward_claimed_coins,
                        m.home_team,
                        m.away_team,
                    m.match_datetime,
                    m.home_goals AS match_home_goals,
                    m.away_goals AS match_away_goals
                 FROM match_predictions mp
                 JOIN matches m ON m.id = mp.match_id
                 WHERE mp.user_id = ?
                 ORDER BY mp.created_at DESC, mp.id DESC`,
                [req.user.sub],
            );

            const predictions = rows.map((row) => {
                const actualHomeGoals = row.match_home_goals == null ? null : Number(row.match_home_goals);
                const actualAwayGoals = row.match_away_goals == null ? null : Number(row.match_away_goals);
                const reward = evaluatePredictionReward({
                    predictedHomeGoals: Number(row.home_goals),
                    predictedAwayGoals: Number(row.away_goals),
                    actualHomeGoals,
                    actualAwayGoals,
                });
                const rewardClaimedAt = row.reward_claimed_at || null;

                return {
                    id: row.id,
                    matchId: row.match_id,
                    homeGoals: Number(row.home_goals),
                    awayGoals: Number(row.away_goals),
                    createdAt: row.created_at,
                    reward: {
                        badgeKey: reward.badgeKey,
                        badgeLabel: reward.badgeLabel,
                        rewardCoins: reward.rewardCoins,
                        resolved: reward.resolved,
                        claimed: Boolean(rewardClaimedAt),
                        canClaimReward: reward.resolved && reward.rewardCoins > 0 && !rewardClaimedAt,
                        claimedAt: rewardClaimedAt,
                        claimedCoins: Number(row.reward_claimed_coins || 0),
                    },
                    match: {
                        id: row.match_id,
                        homeTeam: row.home_team,
                        awayTeam: row.away_team,
                        matchDatetime: row.match_datetime,
                        homeGoals: actualHomeGoals,
                        awayGoals: actualAwayGoals,
                    },
                };
            });

            return res.json({ predictions });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar seus palpites", detail: err.message });
        }
    });

    router.post("/matches/predictions/rewards/claim", authMiddleware, async (req, res) => {
        try {
            const claimedAt = typeof nowSqlTimestamp === "function"
                ? nowSqlTimestamp()
                : new Date().toISOString();
            const result = claimPredictionRewardsTx(req.user.sub, claimedAt);

            if (result.awardedCoins <= 0) {
                return res.status(409).json({
                    error: "Nenhum premio disponível para resgate no momento",
                    awardedCoins: 0,
                    claimedCount: 0,
                    tradeCoins: result.tradeCoins,
                });
            }

            return res.json({
                ok: true,
                awardedCoins: result.awardedCoins,
                claimedCount: result.claimedCount,
                tradeCoins: result.tradeCoins,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao resgatar premio", detail: err.message });
        }
    });

    router.get("/matches/:id", authMiddleware, async (req, res) => {
        try {
            const id = parsePositiveId(req.params?.id);
            if (!id) return res.status(400).json({ error: "ID de partida invalido" });

            const row = await get(
                `SELECT id, home_team, away_team, match_datetime, home_goals, away_goals
                 FROM matches
                 WHERE id = ?`,
                [id],
            );

            if (!row) return res.status(404).json({ error: "Partida nao encontrada" });

            return res.json({
                match: {
                    id: row.id,
                    homeTeam: row.home_team,
                    awayTeam: row.away_team,
                    matchDatetime: row.match_datetime,
                    homeGoals: row.home_goals == null ? null : Number(row.home_goals),
                    awayGoals: row.away_goals == null ? null : Number(row.away_goals),
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar partida", detail: err.message });
        }
    });

    router.post("/matches", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const { homeTeam, awayTeam, matchDatetime, homeGoals, awayGoals } = parseMatchPayload(req.body);
            if (!homeTeam || !awayTeam || !matchDatetime) {
                return res.status(400).json({
                    error: "Campos obrigatorios: home_team, away_team, match_datetime",
                });
            }
            if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
                return res.status(400).json({ error: "Gols devem ser inteiros >= 0 ou null" });
            }

            const result = await run(
                `INSERT INTO matches(home_team, away_team, match_datetime, home_goals, away_goals)
                 VALUES(?, ?, ?, ?, ?)`,
                [homeTeam, awayTeam, matchDatetime, homeGoals, awayGoals],
            );

            return res.status(201).json({
                ok: true,
                match: {
                    id: result.lastID,
                    homeTeam,
                    awayTeam,
                    matchDatetime,
                    homeGoals,
                    awayGoals,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao criar partida", detail: err.message });
        }
    });

    router.put("/matches/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const id = parsePositiveId(req.params?.id);
            if (!id) return res.status(400).json({ error: "ID de partida invalido" });

            const { homeTeam, awayTeam, matchDatetime, homeGoals, awayGoals } = parseMatchPayload(req.body);
            if (!homeTeam || !awayTeam || !matchDatetime) {
                return res.status(400).json({
                    error: "Campos obrigatorios: home_team, away_team, match_datetime",
                });
            }
            if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
                return res.status(400).json({ error: "Gols devem ser inteiros >= 0 ou null" });
            }

            const result = await run(
                `UPDATE matches
                 SET home_team = ?, away_team = ?, match_datetime = ?, home_goals = ?, away_goals = ?
                 WHERE id = ?`,
                [homeTeam, awayTeam, matchDatetime, homeGoals, awayGoals, id],
            );

            if (!result || Number(result.changes || 0) !== 1) {
                return res.status(404).json({ error: "Partida nao encontrada" });
            }

            return res.json({
                ok: true,
                match: {
                    id,
                    homeTeam,
                    awayTeam,
                    matchDatetime,
                    homeGoals,
                    awayGoals,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao atualizar partida", detail: err.message });
        }
    });

    router.patch("/matches/:id/goals", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const id = parsePositiveId(req.params?.id);
            if (!id) return res.status(400).json({ error: "ID de partida invalido" });

            const { homeGoals, awayGoals } = parseMatchPayload(req.body);
            if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
                return res.status(400).json({ error: "Gols devem ser inteiros >= 0 ou null" });
            }

            const result = await run(
                `UPDATE matches
                 SET home_goals = ?, away_goals = ?
                 WHERE id = ?`,
                [homeGoals, awayGoals, id],
            );

            if (!result || Number(result.changes || 0) !== 1) {
                return res.status(404).json({ error: "Partida nao encontrada" });
            }

            return res.json({
                ok: true,
                match: {
                    id,
                    homeGoals,
                    awayGoals,
                },
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao atualizar gols", detail: err.message });
        }
    });

    router.delete("/matches/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
        try {
            const id = parsePositiveId(req.params?.id);
            if (!id) return res.status(400).json({ error: "ID de partida invalido" });

            const result = await run("DELETE FROM matches WHERE id = ?", [id]);
            if (!result || Number(result.changes || 0) !== 1) {
                return res.status(404).json({ error: "Partida nao encontrada" });
            }

            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao excluir partida", detail: err.message });
        }
    });

    router.post("/matches/:id/predictions", authMiddleware, async (req, res) => {
        try {
            const matchId = parsePositiveId(req.params?.id);
            if (!matchId) return res.status(400).json({ error: "ID de partida invalido" });

            const homeGoals = parseScore(req.body?.homeGoals ?? req.body?.home_goals);
            const awayGoals = parseScore(req.body?.awayGoals ?? req.body?.away_goals);
            if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
                return res.status(400).json({ error: "Palpite invalido: gols devem ser inteiros entre 0 e 99" });
            }

            const matchRow = await get(
                `SELECT id, match_datetime
                 FROM matches
                 WHERE id = ?`,
                [matchId],
            );
            if (!matchRow) return res.status(404).json({ error: "Partida nao encontrada" });

            const kickoffMs = new Date(matchRow.match_datetime).getTime();
            if (!Number.isFinite(kickoffMs)) {
                return res.status(500).json({ error: "Data da partida invalida no banco" });
            }

            const deadlineMs = kickoffMs - (3 * 60 * 60 * 1000);
            if (Date.now() > deadlineMs) {
                return res.status(409).json({
                    error: "Prazo encerrado: o palpite deve ser enviado ate 3 horas antes do inicio do jogo",
                });
            }

            const result = await run(
                `INSERT INTO match_predictions(user_id, match_id, home_goals, away_goals)
                 VALUES(?, ?, ?, ?)`,
                [req.user.sub, matchId, homeGoals, awayGoals],
            );

            return res.status(201).json({
                ok: true,
                prediction: {
                    id: result.lastID,
                    userId: req.user.sub,
                    matchId,
                    homeGoals,
                    awayGoals,
                },
            });
        } catch (err) {
            const msg = String(err?.message || "").toLowerCase();
            if (msg.includes("unique") && msg.includes("match_predictions.user_id") && msg.includes("match_predictions.match_id")) {
                return res.status(409).json({ error: "Voce ja enviou um palpite para esta partida" });
            }
            if (msg.includes("check constraint failed")) {
                return res.status(400).json({ error: "Palpite invalido: gols devem ser inteiros entre 0 e 99" });
            }
            return res.status(500).json({ error: "Erro ao registrar palpite", detail: err.message });
        }
    });

    return router;
}

module.exports = {
    createMatchRoutes,
};