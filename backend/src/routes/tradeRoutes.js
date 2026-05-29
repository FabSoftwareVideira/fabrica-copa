const express = require("express");
const { TRADE_COINS_PER_TRADE } = require("../config/constants");

function createTradeRoutes({
    authMiddleware,
    requireTradeWindowOpen,
    STICKERS,
    STICKER_BY_ID,
    getValidCollectedMap,
    all,
    get,
    run,
    nowSqlTimestamp,
    getAlbumState,
    // TRADE_COINS_PER_TRADE,
    TRADE_AVAILABLE_LIMIT,
    TRADE_AVAILABLE_REROLL_COST,
    buildTradeAvailableEntries,
    getCachedTradeAvailableSelection,
    pickTradeAvailableSelection,
    setCachedTradeAvailableSelection,
    transaction,
}) {
    const router = express.Router();

    router.get("/trade/users", authMiddleware, async (req, res) => {
        try {
            const users = await all("SELECT id, name FROM users WHERE id != ? AND is_blocked = 0", [req.user.sub]);
            const result = [];
            for (const user of users) {
                const validCollected = await getValidCollectedMap(user.id);
                const duplicateCount = Object.values(validCollected).reduce(
                    (acc, count) => acc + Math.max(0, Number(count) - 1),
                    0
                );
                result.push({ id: user.id, name: user.name, duplicateCount });
            }
            return res.json({ users: result });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao listar usuarios", detail: err.message });
        }
    });

    router.get("/trade/users/:userId/duplicates", authMiddleware, async (req, res) => {
        try {
            const userId = Number(req.params.userId);
            if (!userId) return res.status(400).json({ error: "userId invalido" });

            const user = await get("SELECT id, name FROM users WHERE id = ? AND is_blocked = 0", [userId]);
            if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

            const validCollected = await getValidCollectedMap(userId);
            const duplicates = STICKERS
                .filter((s) => (validCollected[s.id] || 0) > 1)
                .map((s) => ({ ...s, count: Number(validCollected[s.id]) }));

            return res.json({ user: { id: user.id, name: user.name }, duplicates });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar repetidas", detail: err.message });
        }
    });

    router.get("/trade/users/:userId/wanted-from-me", authMiddleware, async (req, res) => {
        try {
            const userId = Number(req.params.userId);
            if (!userId) return res.status(400).json({ error: "userId invalido" });
            if (userId === req.user.sub) return res.status(400).json({ error: "Nao pode consultar a si mesmo" });

            const user = await get("SELECT id, name FROM users WHERE id = ? AND is_blocked = 0", [userId]);
            if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

            const myState = await getValidCollectedMap(req.user.sub);
            const targetState = await getValidCollectedMap(userId);

            const pendingRows = await all(
                `SELECT offered_sticker_id, COUNT(*) AS pending_count
                 FROM trade_offers
                 WHERE from_user_id = ? AND status = 'pending'
                 GROUP BY offered_sticker_id`,
                [req.user.sub]
            );
            const pendingByStickerId = new Map(
                pendingRows.map((r) => [String(r.offered_sticker_id), Number(r.pending_count || 0)])
            );

            const wantedFromMe = STICKERS
                .filter((s) => {
                    const myCount = Number(myState[s.id] || 0);
                    const reservedPending = Number(pendingByStickerId.get(String(s.id)) || 0);
                    const tradableCount = Math.max(0, myCount - 1 - reservedPending);
                    return tradableCount > 0 && (targetState[s.id] || 0) < 1;
                })
                .map((s) => {
                    const myCount = Number(myState[s.id] || 0);
                    const reservedPending = Number(pendingByStickerId.get(String(s.id)) || 0);
                    const tradableCount = Math.max(0, myCount - 1 - reservedPending);
                    return { ...s, count: tradableCount };
                })
                .sort((a, b) => a.num - b.num);

            return res.json({ user: { id: user.id, name: user.name }, stickers: wantedFromMe });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar figurinhas desejadas", detail: err.message });
        }
    });

    router.post("/trade/offers", authMiddleware, requireTradeWindowOpen, async (req, res) => {
        try {
            const { toUserId, offeredStickerId, requestedStickerId } = req.body || {};

            if (!toUserId || !offeredStickerId || !requestedStickerId) {
                return res.status(400).json({ error: "Campos obrigatorios: toUserId, offeredStickerId, requestedStickerId" });
            }
            const recentOffers = await get(
                `SELECT COUNT(*) AS count FROM trade_offers 
                 WHERE from_user_id = ? AND created_at >= datetime('now', '-1 minute')`,
                [req.user.sub]
            );
            if (recentOffers && recentOffers.count >= 30) {
                return res.status(429).json({ 
                    error: "Limite excedido. Para evitar spam, voce so pode enviar 30 propostas por minuto." 
                });
            }
            if (Number(toUserId) === req.user.sub) {
                return res.status(400).json({ error: "Nao pode trocar com si mesmo" });
            }
            if (!STICKER_BY_ID.has(offeredStickerId)) {
                return res.status(400).json({ error: "Figurinha oferecida nao encontrada" });
            }
            if (!STICKER_BY_ID.has(requestedStickerId)) {
                return res.status(400).json({ error: "Figurinha solicitada nao encontrada" });
            }

            const fromState = await getValidCollectedMap(req.user.sub);
            if ((fromState[offeredStickerId] || 0) <= 1) {
                return res.status(400).json({ error: "Voce precisa ter ao menos uma figurinha repetida para oferecer" });
            }

            const pendingCount = await get(
                `SELECT COUNT(*) AS count
                 FROM trade_offers
                 WHERE from_user_id = ?
                   AND offered_sticker_id = ?
                   AND status = 'pending'`,
                [req.user.sub, offeredStickerId]
            );
            const myCount = Number(fromState[offeredStickerId] || 0);
            const reservedPending = Number(pendingCount?.count || 0);
            const tradableCount = Math.max(0, myCount - 1 - reservedPending);

            if (tradableCount <= 0) {
                return res.status(409).json({
                    error: "Voce nao tem cópias disponiveis dessa figurinha para oferecer (todas estao em trocas pendentes ou reservadas).",
                });
            }

            // Buscar email e preferência de notificação do usuário destinatário
            const toUserRow = await get("SELECT id, is_blocked, email, name, wants_emails FROM users WHERE id = ?", [Number(toUserId)]);
            if (!toUserRow) return res.status(404).json({ error: "Usuario destino nao encontrado" });
            if (Number(toUserRow.is_blocked || 0) === 1) {
                return res.status(400).json({ error: "Nao e possivel trocar com usuario bloqueado" });
            }

            const pendingSameTargetSticker = await get(
                `SELECT id
                 FROM trade_offers
                 WHERE from_user_id = ?
                   AND to_user_id = ?
                   AND requested_sticker_id = ?
                   AND status = 'pending'
                 LIMIT 1`,
                [req.user.sub, Number(toUserId), requestedStickerId]
            );
            if (pendingSameTargetSticker) {
                return res.status(409).json({
                    error: "Voce ja possui uma proposta pendente para essa figurinha deste usuario.",
                });
            }

            const toState = await getValidCollectedMap(Number(toUserId));
            if ((toState[requestedStickerId] || 0) <= 1) {
                const requestedSticker = STICKER_BY_ID.get(requestedStickerId);
                return res.status(400).json({
                    error: `O outro usuario nao possui a figurinha solicitada (#${requestedSticker?.num || "?"} ${requestedSticker?.name || requestedStickerId}) em quantidade repetida.`,
                });
            }

            const nowTimestamp = nowSqlTimestamp();
            const result = await run(
                `INSERT INTO trade_offers(from_user_id, to_user_id, offered_sticker_id, requested_sticker_id, status, created_at, updated_at)
                 VALUES(?, ?, ?, ?, 'pending', ?, ?)`,
                [req.user.sub, Number(toUserId), offeredStickerId, requestedStickerId, nowTimestamp, nowTimestamp]
            );

            const offeredSticker = STICKER_BY_ID.get(offeredStickerId);
            const requestedSticker = STICKER_BY_ID.get(requestedStickerId);
            const eventMessage = `${req.user.name} enviou uma oferta de troca: ${offeredSticker?.name || "figurinha"} por ${requestedSticker?.name || "figurinha"}`;
            const eventPayload = {
                offerId: result.lastID,
                fromUserId: req.user.sub,
                fromUserName: req.user.name,
                toUserId: Number(toUserId),
                offeredStickerId,
                offeredStickerName: offeredSticker?.name,
                requestedStickerId,
                requestedStickerName: requestedSticker?.name,
            };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('trade_offer_created', ?, ?, ?, ?, ?)`,
                [eventMessage, JSON.stringify(eventPayload), req.user.sub, Number(toUserId), nowTimestamp]
            );

            // Enviar email para o destinatário, se houver email cadastrado e quiser receber
            if (toUserRow.wants_emails) {
                const TradeOfferNotifier = require("../services/TradeOfferNotifier");
                TradeOfferNotifier.notifyTradeOffer({
                    toEmail: toUserRow.email,
                    toName: toUserRow.name,
                    fromName: req.user.name,
                    offeredStickerName: offeredSticker?.name || offeredStickerId,
                    requestedStickerName: requestedSticker?.name || requestedStickerId,
                }).catch((err) => {
                    console.error("[TradeRoutes] Falha ao enviar email de notificação de nova oferta de troca:", err);
                });
            }

            return res.status(201).json({ ok: true, offerId: result.lastID });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao criar oferta", detail: err.message });
        }
    });

    router.get("/trade/offers", authMiddleware, async (req, res) => {
        try {
            const incomingRows = await all(
                `SELECT o.id, o.from_user_id, o.offered_sticker_id, o.requested_sticker_id, o.status, o.created_at,
                        u.name AS from_user_name
                 FROM trade_offers o
                 JOIN users u ON u.id = o.from_user_id
                 WHERE o.to_user_id = ? AND o.status = 'pending' AND u.is_blocked = 0
                 ORDER BY o.created_at DESC`,
                [req.user.sub]
            );

            const outgoingRows = await all(
                `SELECT o.id, o.to_user_id, o.offered_sticker_id, o.requested_sticker_id, o.status, o.created_at,
                        u.name AS to_user_name
                 FROM trade_offers o
                 JOIN users u ON u.id = o.to_user_id
                 WHERE o.from_user_id = ? AND o.status = 'pending' AND u.is_blocked = 0
                 ORDER BY o.created_at DESC`,
                [req.user.sub]
            );

            const mapOffer = (r, extra) => ({
                id: r.id,
                offeredSticker: STICKER_BY_ID.get(r.offered_sticker_id) || { id: r.offered_sticker_id },
                requestedSticker: STICKER_BY_ID.get(r.requested_sticker_id) || { id: r.requested_sticker_id },
                status: r.status,
                createdAt: r.created_at,
                ...extra,
            });

            return res.json({
                incoming: incomingRows.map((r) => mapOffer(r, { fromUserId: r.from_user_id, fromUserName: r.from_user_name })),
                outgoing: outgoingRows.map((r) => mapOffer(r, { toUserId: r.to_user_id, toUserName: r.to_user_name })),
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar ofertas", detail: err.message });
        }
    });

    router.post("/trade/offers/:id/accept", authMiddleware, requireTradeWindowOpen, async (req, res) => {
        try {
            const offerId = Number(req.params.id);
            const offer = await get(
                `SELECT o.*
                 FROM trade_offers o
                 JOIN users uf ON uf.id = o.from_user_id
                 JOIN users ut ON ut.id = o.to_user_id
                 WHERE o.id = ? AND o.to_user_id = ? AND o.status = 'pending'
                   AND uf.is_blocked = 0 AND ut.is_blocked = 0`,
                [offerId, req.user.sub]
            );
            if (!offer) return res.status(404).json({ error: "Oferta nao encontrada" });

            const nowTimestamp = nowSqlTimestamp();

            try {
                await transaction(async () => {
                    const fromRow = await get("SELECT collected_json FROM album_states WHERE user_id = ?", [offer.from_user_id]);
                    const toRow = await get("SELECT collected_json FROM album_states WHERE user_id = ?", [offer.to_user_id]);
                    
                    const fromCollected = fromRow && fromRow.collected_json ? JSON.parse(fromRow.collected_json) : {};
                    const toCollected = toRow && toRow.collected_json ? JSON.parse(toRow.collected_json) : {};

                    if ((fromCollected[offer.offered_sticker_id] || 0) <= 1) {
                        await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
                        throw new Error("O outro usuario nao tem mais essa figurinha repetida");
                    }
                    if ((toCollected[offer.requested_sticker_id] || 0) <= 1) {
                        await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
                        throw new Error("Voce nao tem mais essa figurinha repetida");
                    }

                    fromCollected[offer.offered_sticker_id] = Number(fromCollected[offer.offered_sticker_id]) - 1;
                    fromCollected[offer.requested_sticker_id] = (Number(fromCollected[offer.requested_sticker_id]) || 0) + 1;

                    toCollected[offer.requested_sticker_id] = Number(toCollected[offer.requested_sticker_id]) - 1;
                    toCollected[offer.offered_sticker_id] = (Number(toCollected[offer.offered_sticker_id]) || 0) + 1;

                    await run(
                        "UPDATE album_states SET collected_json = ?, updated_at = ? WHERE user_id = ?",
                        [JSON.stringify(fromCollected), nowTimestamp, offer.from_user_id]
                    );
                    await run(
                        "UPDATE album_states SET collected_json = ?, trade_coins = trade_coins + ?, updated_at = ? WHERE user_id = ?",
                        [JSON.stringify(toCollected), TRADE_COINS_PER_TRADE, nowTimestamp, offer.to_user_id]
                    );
                    await run(
                        "UPDATE album_states SET trade_coins = trade_coins + ?, updated_at = ? WHERE user_id = ?",
                        [TRADE_COINS_PER_TRADE, nowTimestamp, offer.from_user_id]
                    );
                    await run(
                        "UPDATE trade_offers SET status = 'accepted', updated_at = ? WHERE id = ?",
                        [nowTimestamp, offerId]
                    );

                    await run(
                        "INSERT INTO trade_history(user_id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id, completed_at) VALUES(?, ?, ?, ?, ?, ?)",
                        [offer.from_user_id, offer.from_user_id, offer.to_user_id, offer.offered_sticker_id, offer.requested_sticker_id, nowTimestamp]
                    );
                    await run(
                        "INSERT INTO trade_history(user_id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id, completed_at) VALUES(?, ?, ?, ?, ?, ?)",
                        [offer.to_user_id, offer.from_user_id, offer.to_user_id, offer.requested_sticker_id, offer.offered_sticker_id, nowTimestamp]
                    );

                    const coinsReceived = TRADE_COINS_PER_TRADE;
                    const offeredSticker = STICKER_BY_ID.get(offer.offered_sticker_id);
                    const requestedSticker = STICKER_BY_ID.get(offer.requested_sticker_id);
                    const creatorUser = await get("SELECT name FROM users WHERE id = ?", [offer.from_user_id]);
                    const acceptorUser = await get("SELECT name FROM users WHERE id = ?", [offer.to_user_id]);
                    
                    const sharedPayload = {
                        offerId,
                        fromUserId: offer.from_user_id,
                        fromUserName: creatorUser?.name,
                        toUserId: offer.to_user_id,
                        toUserName: acceptorUser?.name,
                        offeredStickerId: offer.offered_sticker_id,
                        offeredStickerNum: offeredSticker?.num,
                        offeredStickerName: offeredSticker?.name,
                        requestedStickerId: offer.requested_sticker_id,
                        requestedStickerNum: requestedSticker?.num,
                        requestedStickerName: requestedSticker?.name,
                        coinsReceived,
                    };
                    
                    await run(
                        `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                         VALUES('trade_accepted', ?, ?, ?, ?, ?)`,
                        [
                            `${acceptorUser?.name || "Usuário"} aceitou sua troca: #${offeredSticker?.num} ${offeredSticker?.name || "figurinha"} por #${requestedSticker?.num} ${requestedSticker?.name || "figurinha"}. Você recebeu ${coinsReceived} moedas.`,
                            JSON.stringify({ ...sharedPayload, recipientUserId: offer.from_user_id, recipientUserName: creatorUser?.name, coinsReceived }),
                            offer.to_user_id, offer.from_user_id, nowTimestamp,
                        ]
                    );
                    await run(
                        `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                         VALUES('trade_accepted', ?, ?, ?, ?, ?)` ,
                        [
                            `Você aceitou a troca de ${creatorUser?.name || "Usuário"}: #${requestedSticker?.num} ${requestedSticker?.name || "figurinha"} por #${offeredSticker?.num} ${offeredSticker?.name || "figurinha"}. Você recebeu ${coinsReceived} moedas.`,
                            JSON.stringify({ ...sharedPayload, recipientUserId: offer.to_user_id, recipientUserName: acceptorUser?.name, coinsReceived }),
                            offer.to_user_id, offer.to_user_id, nowTimestamp,
                        ]
                    );
                });
            } catch (err) {
                if (err.message.includes("nao tem mais")) return res.status(409).json({ error: err.message });
                return res.status(500).json({ error: "Erro ao aceitar oferta (transação)", detail: err.message });
            }

            let newState, validCollected;
            ({ state: newState } = await getAlbumState(req.user.sub));
            validCollected = await getValidCollectedMap(req.user.sub);
            return res.json({ ok: true, state: { ...newState, collected: validCollected } });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao aceitar oferta", detail: err.message });
        }
    });

    router.post("/trade/coins/redeem", authMiddleware, async (req, res) => {
        try {
            const COINS_PER_COUPON = 10;
            const { state } = await getAlbumState(req.user.sub);
            const currentCoins = Number(state.tradeCoins || 0);

            if (currentCoins < COINS_PER_COUPON) {
                return res.status(400).json({
                    error: "Moedas insuficientes para resgate",
                    tradeCoins: currentCoins,
                    requiredCoins: COINS_PER_COUPON,
                });
            }

            const nowTimestamp = nowSqlTimestamp();
            const nextCoins = currentCoins - COINS_PER_COUPON;

            await run(
                "UPDATE album_states SET trade_coins = ?, extra_packs = extra_packs + 1, updated_at = ? WHERE user_id = ?",
                [nextCoins, nowTimestamp, req.user.sub]
            );

            const { state: newState } = await getAlbumState(req.user.sub);

            const eventPayload = { packs: 1, spentCoins: COINS_PER_COUPON, remainingCoins: nextCoins };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('trade_coins_redeemed', ?, ?, ?, ?, ?)`,
                [
                    `Você trocou ${COINS_PER_COUPON} moedas por 1 pacote de figurinhas.`,
                    JSON.stringify(eventPayload),
                    req.user.sub,
                    req.user.sub,
                    nowTimestamp,
                ]
            );

            return res.status(201).json({
                ok: true,
                tradeCoins: nextCoins,
                extraPacks: Number(newState.extraPacks || 0),
                requiredCoins: COINS_PER_COUPON,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao resgatar moedas", detail: err.message });
        }
    });

    router.post("/trade/offers/:id/reject", authMiddleware, requireTradeWindowOpen, async (req, res) => {
        try {
            const offerId = Number(req.params.id);
            const offer = await get(
                `SELECT * FROM trade_offers WHERE id = ? AND (to_user_id = ? OR from_user_id = ?) AND status = 'pending'`,
                [offerId, req.user.sub, req.user.sub]
            );
            if (!offer) return res.status(404).json({ error: "Oferta nao encontrada" });

            const newStatus = offer.to_user_id === req.user.sub ? "rejected" : "cancelled";
            const nowTimestamp = nowSqlTimestamp();
            await run(
                "UPDATE trade_offers SET status = ?, updated_at = ? WHERE id = ?",
                [newStatus, nowTimestamp, offerId]
            );

            if (offer.to_user_id === req.user.sub) {
                const rejectorUser = await get("SELECT name FROM users WHERE id = ?", [req.user.sub]);
                const eventMessage = `${rejectorUser?.name || "Usuário"} rejeitou sua troca!`;
                const eventPayload = {
                    offerId,
                    fromUserId: offer.from_user_id,
                    toUserId: offer.to_user_id,
                    toUserName: rejectorUser?.name,
                    offeredStickerId: offer.offered_sticker_id,
                    requestedStickerId: offer.requested_sticker_id,
                };
                await run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('trade_rejected', ?, ?, ?, ?, ?)`,
                    [eventMessage, JSON.stringify(eventPayload), req.user.sub, offer.from_user_id, nowTimestamp]
                );
            } else {
                const cancellatorUser = await get("SELECT name FROM users WHERE id = ?", [req.user.sub]);
                const eventMessage = `${cancellatorUser?.name || "Usuário"} cancelou a troca pendente!`;
                const eventPayload = {
                    offerId,
                    fromUserId: offer.from_user_id,
                    toUserId: offer.to_user_id,
                    fromUserName: cancellatorUser?.name,
                };
                await run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('trade_cancelled', ?, ?, ?, ?, ?)`,
                    [eventMessage, JSON.stringify(eventPayload), req.user.sub, offer.to_user_id, nowTimestamp]
                );
            }
            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao recusar oferta", detail: err.message });
        }
    });

    router.get("/trade/available", authMiddleware, async (req, res) => {
        try {
            const allAvailable = await buildTradeAvailableEntries(req.user.sub);
            const available = getCachedTradeAvailableSelection(req.user.sub, allAvailable);
            // Buscar tradeRerollCount, tradeRerollDate, tradeCoins
            const { state } = await getAlbumState(req.user.sub);

            return res.json({
                available,
                totalAvailable: allAvailable.length,
                hasMore: allAvailable.length > available.length,
                limit: TRADE_AVAILABLE_LIMIT,
                tradeRerollCount: state.tradeRerollCount,
                tradeRerollDate: state.tradeRerollDate,
                tradeCoins: state.tradeCoins,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar figurinhas disponíveis", detail: err.message });
        }
    });

    // Permitir 5 rerolls grátis por dia, depois cobrar 1 coin por reroll
    router.post("/trade/available/reroll", authMiddleware, async (req, res) => {
        try {
            const { state } = await getAlbumState(req.user.sub);
            const currentCoins = Number(state.tradeCoins || 0);
            const today = new Date().toISOString().slice(0, 10);
            let rerollCount = Number(state.tradeRerollCount || 0);
            let rerollDate = state.tradeRerollDate || "";
            const FREE_REROLLS_PER_DAY = 5;

            // Resetar contador se mudou o dia
            if (rerollDate !== today) {
                rerollCount = 0;
                rerollDate = today;
            }

            // Limitar a 5 rerolls grátis, depois só se tiver moedas
            let isFree = rerollCount < FREE_REROLLS_PER_DAY;
            let isPaid = !isFree;

            // Se já fez 5 rerolls e não tem moedas, não pode mais
            if (isPaid && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Moedas insuficientes para ver novas figurinhas",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls e não quer pagar, bloquear
            if (!isFree && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Limite de rerolls grátis atingido e moedas insuficientes.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls e não tem moedas, bloquear
            if (!isFree && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Limite de rerolls atingido.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls pagos, impedir continuar se não tem moedas
            if (!isFree && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Moedas insuficientes para reroll pago.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls grátis e não tem moedas, impedir
            if (rerollCount >= FREE_REROLLS_PER_DAY && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Você já usou todos os rerolls grátis e não tem moedas suficientes.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls grátis e tem moedas, permite reroll pago
            if (rerollCount >= FREE_REROLLS_PER_DAY && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Você já usou todos os rerolls grátis e não tem moedas suficientes.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls grátis e tem moedas, permite reroll pago
            if (rerollCount >= FREE_REROLLS_PER_DAY && currentCoins >= TRADE_AVAILABLE_REROLL_COST) {
                isFree = false;
                isPaid = true;
            }

            // Se já fez 5 rerolls grátis e não tem moedas, impedir
            if (rerollCount >= FREE_REROLLS_PER_DAY && currentCoins < TRADE_AVAILABLE_REROLL_COST) {
                return res.status(400).json({
                    error: "Você já usou todos os rerolls grátis e não tem moedas suficientes.",
                    tradeCoins: currentCoins,
                    requiredCoins: TRADE_AVAILABLE_REROLL_COST,
                });
            }

            // Se já fez 5 rerolls grátis e tem moedas, permite reroll pago
            let nextCoins = currentCoins;
            let nextRerollCount = rerollCount;
            let spentCoins = 0;
            if (isFree) {
                nextRerollCount++;
                spentCoins = 0;
            } else if (isPaid) {
                nextCoins = Math.max(0, currentCoins - TRADE_AVAILABLE_REROLL_COST);
                nextRerollCount++;
                spentCoins = TRADE_AVAILABLE_REROLL_COST;
            }

            const allAvailable = await buildTradeAvailableEntries(req.user.sub);
            if (allAvailable.length <= TRADE_AVAILABLE_LIMIT) {
                return res.status(400).json({
                    error: "Nao ha mais figurinhas disponiveis para sortear no momento",
                    tradeCoins: currentCoins,
                    totalAvailable: allAvailable.length,
                    limit: TRADE_AVAILABLE_LIMIT,
                });
            }

            const available = pickTradeAvailableSelection(
                allAvailable,
                Array.isArray(req.body?.excludeStickerIds) ? req.body.excludeStickerIds : []
            );

            setCachedTradeAvailableSelection(req.user.sub, available);

            const nowTimestamp = nowSqlTimestamp();
            await run(
                "UPDATE album_states SET trade_coins = ?, trade_reroll_count = ?, trade_reroll_date = ?, updated_at = ? WHERE user_id = ?",
                [nextCoins, nextRerollCount, rerollDate, nowTimestamp, req.user.sub]
            );

            return res.status(201).json({
                ok: true,
                available,
                tradeCoins: nextCoins,
                spentCoins,
                tradeAvailableRerollCount: nextRerollCount,
                totalAvailable: allAvailable.length,
                hasMore: allAvailable.length > available.length,
                limit: TRADE_AVAILABLE_LIMIT,
                freeRerollsPerDay: FREE_REROLLS_PER_DAY,
                tradeRerollCount: nextRerollCount,
                tradeRerollDate: rerollDate,
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao sortear novas figurinhas", detail: err.message });
        }
    });

    router.get("/trade/history", authMiddleware, async (req, res) => {
        try {
            const history = await all(
                "SELECT * FROM trade_history WHERE user_id = ? ORDER BY completed_at DESC",
                [req.user.sub]
            );

            const enriched = history.map((h) => ({
                id: h.id,
                completedAt: h.completed_at,
                partnerName: h.from_user_id === req.user.sub
                    ? (h.to_user_id ? "..." : "Desconhecido")
                    : (h.from_user_id ? "..." : "Desconhecido"),
                partnerUserId: h.from_user_id === req.user.sub ? h.to_user_id : h.from_user_id,
                offeredSticker: STICKER_BY_ID.get(h.offered_sticker_id) || { id: h.offered_sticker_id, name: "Desconhecida" },
                requestedSticker: STICKER_BY_ID.get(h.requested_sticker_id) || { id: h.requested_sticker_id, name: "Desconhecida" },
                iSent: h.from_user_id === req.user.sub,
            }));

            if (enriched.length > 0) {
                const partnerIds = [...new Set(enriched.map((h) => h.partnerUserId).filter(Boolean))];
                if (partnerIds.length > 0) {
                    const placeholders = partnerIds.map(() => "?").join(",");
                    const partners = await all(`SELECT id, name FROM users WHERE id IN (${placeholders})`, partnerIds);
                    const partnerMap = new Map(partners.map((p) => [p.id, p.name]));
                    enriched.forEach((h) => {
                        if (h.partnerUserId && partnerMap.has(h.partnerUserId)) {
                            h.partnerName = partnerMap.get(h.partnerUserId);
                        }
                    });
                }
            }

            return res.json({ history: enriched });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar histórico de trocas", detail: err.message });
        }
    });

    return router;
}

module.exports = {
    createTradeRoutes,
};
