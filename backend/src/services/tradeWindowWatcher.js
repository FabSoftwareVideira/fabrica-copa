"use strict";

/**
 * Background watcher that polls trade windows every 30 s and:
 *   - Emits a system_event when a window opens or closes
 *   - Cancels all pending trade offers when a window closes
 *
 * @param {object} deps
 * @param {Function} deps.run
 * @param {Function} deps.all
 * @param {Function} deps.getAllTradeWindows
 * @param {Function} deps.toTradeWindowsPayload
 * @param {Map}      deps.STICKER_BY_ID
 * @param {string}   deps.APP_TIMEZONE
 * @param {Function} deps.nowSqlTimestamp
 * @param {Function} deps.logError
 */

const { FRONTEND_URL } = require("../config/env");
const { TradeWindowEmailNotifier } = require("../infrastructure/TradeWindowEmailNotifier");
const { TradeWindowStateManager } = require("../infrastructure/TradeWindowStateManager");

function createTradeWindowWatcher({
    run,
    all,
    getAllTradeWindows,
    toTradeWindowsPayload,
    STICKER_BY_ID,
    APP_TIMEZONE,
    nowSqlTimestamp,
    logError,
}) {
    const emailNotifier = new TradeWindowEmailNotifier({ all, logError, FRONTEND_URL });
    const stateManager = new TradeWindowStateManager();

    async function cancelPendingOffersForClosedWindow(now) {
        const pendingOffers = await all(
            `SELECT id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id
             FROM trade_offers
             WHERE status = 'pending'`
        );

        for (const offer of pendingOffers) {
            await run(
                "UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?",
                [now, offer.id]
            );

            const offeredSticker = STICKER_BY_ID.get(offer.offered_sticker_id);
            const requestedSticker = STICKER_BY_ID.get(offer.requested_sticker_id);
            const payload = JSON.stringify({
                offerId: offer.id,
                offeredStickerId: offer.offered_sticker_id,
                offeredStickerNum: offeredSticker?.num || "?",
                requestedStickerId: offer.requested_sticker_id,
                requestedStickerNum: requestedSticker?.num || "?",
                reason: "window_closed",
            });

            const insertEvent = (targetUserId) =>
                run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('trade_offer_cancelled', 'trade_offer_cancelled', ?, ?, ?, ?)`,
                    [payload, offer.from_user_id, targetUserId, now]
                );

            await insertEvent(offer.from_user_id);
            await insertEvent(offer.to_user_id);
        }

        return pendingOffers.length;
    }

    async function handleWindowOpened(window, now) {
        stateManager.setOpen(window.id, now);

        const endsAtFormatted = new Date(window.endsAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: APP_TIMEZONE,
        });

        console.log(`[Watcher] Janela de trocas aberta (ID: ${window.id}) até ${endsAtFormatted}`);

        await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
             VALUES('trade_window_opened', ?, ?, NULL, NULL, ?)`,
            [
                `A janela de trocas foi aberta (até ${endsAtFormatted}).`,
                JSON.stringify({ windowId: window.id, startsAt: window.startsAt, endsAt: window.endsAt }),
                now,
            ]
        );

        await emailNotifier.sendTradeWindowOpenedEmails({ endsAtFormatted });
    }

    async function handleWindowClosed(window, now) {
        stateManager.setClosed(window.id);

        console.log(`[Watcher] Janela de trocas encerrada (ID: ${window.id})`);

        const cancelledCount = await cancelPendingOffersForClosedWindow(now);
        console.log(`[Watcher] Total de ofertas pendentes canceladas: ${cancelledCount}`);

        await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
             VALUES('trade_window_closed', ?, ?, NULL, NULL, ?)`,
            [
                `A janela de trocas foi encerrada. ${cancelledCount} oferta(s) pendente(s) cancelada(s).`,
                JSON.stringify({
                    windowId: window.id,
                    startsAt: window.startsAt,
                    endsAt: window.endsAt,
                    cancelledOffers: cancelledCount,
                }),
                now,
            ]
        );
    }

    async function checkTransitions() {
        try {
            console.log('[Watcher] Iniciando verificação de transições de janelas de trocas...');
            const rows = await getAllTradeWindows();
            const windows = toTradeWindowsPayload(rows);
            const now = nowSqlTimestamp();

            for (const w of windows) {
                const prev = stateManager.getState(w.id);
                const wasOpen = prev?.isOpen ?? false;
                const isNowOpen = w.isOpen === true;

                if (prev === undefined) {
                    // First check after startup — record state without emitting events
                    if (isNowOpen) {
                        stateManager.setOpen(w.id, now);
                    } else {
                        stateManager.setClosed(w.id);
                    }
                    console.log(`[Watcher] Estado inicial registrado para janela ${w.id}: ${isNowOpen ? 'aberta' : 'fechada'}`);
                    continue;
                }

                if (!wasOpen && isNowOpen) {
                    console.log(`[Watcher] Detecção: janela ${w.id} foi aberta.`);
                    await handleWindowOpened(w, now);
                } else if (wasOpen && !isNowOpen) {
                    console.log(`[Watcher] Detecção: janela ${w.id} foi fechada.`);
                    await handleWindowClosed(w, now);
                }
            }

            // Remove stale entries for windows that no longer exist
            const activeIds = new Set(windows.map((w) => w.id));
            for (const id of stateManager.keys()) {
                if (!activeIds.has(id)) {
                    stateManager.delete(id);
                    console.log(`[Watcher] Removendo estado obsoleto da janela ${id}`);
                }
            }
            console.log('[Watcher] Verificação de transições concluída.');
        } catch (err) {
            logError("[Watcher] Erro ao verificar transições de janela de trocas", { err });
        }
    }

    let timer = null;
    const POLL_INTERVAL_MS = 30_000;

    async function start() {
        await checkTransitions();
        if (!timer) {
            timer = setInterval(checkTransitions, POLL_INTERVAL_MS);
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    return { start, stop, checkTransitions };
}

module.exports = { createTradeWindowWatcher };