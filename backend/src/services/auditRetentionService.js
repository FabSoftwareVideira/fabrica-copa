"use strict";

function normalizePositiveNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function createAuditRetentionService({
    run,
    logInfo,
    logWarn,
    enabled = true,
    retentionDays = 90,
    cleanupIntervalMs = 24 * 60 * 60 * 1000,
}) {
    const safeRetentionDays = normalizePositiveNumber(retentionDays, 90);
    const safeCleanupIntervalMs = normalizePositiveNumber(cleanupIntervalMs, 24 * 60 * 60 * 1000);

    let timer = null;

    async function cleanupOldLogs() {
        try {
            const retentionModifier = `-${safeRetentionDays} day`;
            const result = run(
                `DELETE FROM audit_logs
                 WHERE date(created_at) < date('now', ?)` ,
                [retentionModifier]
            );

            const deletedRows = Number(result?.changes || 0);
            if (deletedRows > 0) {
                logInfo("[audit] limpeza de retenção executada", {
                    deletedRows,
                    retentionDays: safeRetentionDays,
                });
            }
            return deletedRows;
        } catch (err) {
            logWarn("[audit] falha na limpeza de retenção", {
                retentionDays: safeRetentionDays,
                err,
            });
            return 0;
        }
    }

    async function start() {
        if (!enabled) {
            logInfo("[audit] limpeza automática desativada", { enabled: false });
            return;
        }

        await cleanupOldLogs();

        if (!timer) {
            timer = setInterval(() => {
                cleanupOldLogs().catch((err) => {
                    logWarn("[audit] erro inesperado no agendamento de limpeza", { err });
                });
            }, safeCleanupIntervalMs);

            if (typeof timer.unref === "function") {
                timer.unref();
            }

            logInfo("[audit] agendamento de limpeza iniciado", {
                cleanupIntervalMs: safeCleanupIntervalMs,
                retentionDays: safeRetentionDays,
            });
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    return {
        start,
        stop,
        cleanupOldLogs,
    };
}

module.exports = {
    createAuditRetentionService,
};
