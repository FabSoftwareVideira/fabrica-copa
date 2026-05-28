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
const { sendMail } = require("../utils/email");
const { getAllUserEmails } = require("../utils/user");

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
    // windowId -> { isOpen: boolean, openedAt: timestamp|null }
    const openStates = new Map();

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
        openStates.set(window.id, { isOpen: true, openedAt: now });

        const endsAtFormatted = new Date(window.endsAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: APP_TIMEZONE,
        });

        await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
             VALUES('trade_window_opened', ?, ?, NULL, NULL, ?)`,
            [
                `A janela de trocas foi aberta (até ${endsAtFormatted}).`,
                JSON.stringify({ windowId: window.id, startsAt: window.startsAt, endsAt: window.endsAt }),
                now,
            ]
        );

        try {
            const emails = await getAllUserEmails(all);
            if (emails && emails.length > 0) {
                const subject = "Janela de trocas aberta!";
                const text = `A janela de trocas do álbum está aberta até ${endsAtFormatted}! Aproveite para negociar suas figurinhas.`;

                // AGUARDE e veja os resultados individuais
                const results = await Promise.allSettled(
                    emails.map(email => sendMail({ to: email, subject, text }))
                );


                results.forEach((result, i) => {
                    if (result.status === 'rejected') {
                        logError(`Falha ao enviar email para ${emails[i]}`, { err: result.reason });
                    } else {
                        console.log(`Email enviado para ${emails[i]}:`, result.value.messageId);
                    }
                });
            }
        } catch (err) {
            logError("Falha ao enviar e-mails de notificação de janela de trocas", { err });
        }
    }

    async function handleWindowClosed(window, now) {
        openStates.set(window.id, { isOpen: false, openedAt: null });

        const cancelledCount = await cancelPendingOffersForClosedWindow(now);

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
            const rows = await getAllTradeWindows();
            const windows = toTradeWindowsPayload(rows);
            const now = nowSqlTimestamp();

            for (const w of windows) {
                const prev = openStates.get(w.id);
                const wasOpen = prev?.isOpen ?? false;
                const isNowOpen = w.isOpen === true;

                if (prev === undefined) {
                    // First check after startup — record state without emitting events
                    openStates.set(w.id, { isOpen: isNowOpen, openedAt: isNowOpen ? now : null });
                    continue;
                }

                if (!wasOpen && isNowOpen) {
                    await handleWindowOpened(w, now);
                } else if (wasOpen && !isNowOpen) {
                    await handleWindowClosed(w, now);
                }
            }

            // Remove stale entries for windows that no longer exist
            const activeIds = new Set(windows.map((w) => w.id));
            for (const id of openStates.keys()) {
                if (!activeIds.has(id)) openStates.delete(id);
            }
        } catch (err) {
            logError("Erro ao verificar transições de janela de trocas", { err });
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