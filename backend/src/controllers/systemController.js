function createSystemController({
    NODE_ENV,
    STICKERS,
    logWarn,
    logInfo,
    logError,
}) {
    async function health(_req, res) {
        res.json({ ok: true, service: "album-backend", env: NODE_ENV, stickers: STICKERS.length });
    }

    async function docsJson(swaggerSpec, _req, res) {
        res.json(swaggerSpec);
    }

    async function frontendError(req, res) {
        try {
            const payload = req.body || {};
            const level = String(payload.level || "error").toLowerCase();
            const message = String(payload.message || "Frontend error report");
            const meta = {
                requestId: req.requestId,
                origin: req.get("origin") || "unknown",
                userAgent: req.get("user-agent") || "unknown",
                route: payload.route || "",
                context: payload.context || {},
                details: payload.details || {},
                timestamp: payload.timestamp || "",
            };

            if (level === "warn") {
                logWarn(`Frontend: ${message}`, meta);
            } else if (level === "info") {
                logInfo(`Frontend: ${message}`, meta);
            } else {
                logError(`Frontend: ${message}`, meta);
            }

            return res.status(201).json({ ok: true });
        } catch (err) {
            logError("Failed to process frontend error report", { err, requestId: req.requestId });
            return res.status(500).json({ error: "Erro ao processar log do frontend" });
        }
    }

    return {
        health,
        docsJson,
        frontendError,
    };
}

module.exports = {
    createSystemController,
};
