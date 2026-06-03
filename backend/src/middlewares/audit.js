"use strict";

function createAuditMiddleware({ auditLogService, logWarn }) {
    const AUDITED_PUBLIC_PATHS = new Set([
        "/api/auth/google",
        "/api/auth/test-login",
        "/api/auth/refresh",
        "/api/auth/logout",
    ]);

    const EXCLUDED_PATHS = new Set([
        "/api/health",
        "/api/docs.json",
        "/api/logs/frontend-error",
    ]);

    function shouldAuditRequest(req) {
        const auditContext = req.auditContext || {};
        if (auditContext.skip === true) return false;

        const normalizedPath = String(req.originalUrl || "").split("?")[0] || "";
        if (EXCLUDED_PATHS.has(normalizedPath)) return false;
        if (normalizedPath.startsWith("/api/docs")) return false;
        if (AUDITED_PUBLIC_PATHS.has(normalizedPath)) return true;
        if (req.user?.sub) return true;
        if (auditContext.force === true) return true;
        return false;
    }

    return function auditMiddleware(req, res, next) {
        const startedAt = Date.now();
        let capturedResponseBody = null;

        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 400) {
                capturedResponseBody = body;
            }
            return originalJson(body);
        };

        const originalSend = res.send.bind(res);
        res.send = (body) => {
            if (res.statusCode >= 400 && capturedResponseBody == null) {
                capturedResponseBody = body;
            }
            return originalSend(body);
        };

        res.on("finish", () => {
            if (!shouldAuditRequest(req)) return;
            try {
                auditLogService.recordRequestAudit(req, res, capturedResponseBody, startedAt);
            } catch (err) {
                logWarn("Unexpected audit middleware failure", {
                    requestId: req.requestId,
                    path: req.originalUrl,
                    err,
                });
            }
        });

        next();
    };
}

module.exports = {
    createAuditMiddleware,
};
