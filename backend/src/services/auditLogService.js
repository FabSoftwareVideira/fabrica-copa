"use strict";

function safeParseJson(value, fallback = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_err) {
        return fallback;
    }
}

function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function truncateText(value, maxLength = 512) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function normalizeRoutePath(routePath, originalUrl) {
    const normalizedRoute = String(routePath || "").trim();
    if (normalizedRoute) return normalizedRoute;
    return String(originalUrl || "").split("?")[0] || "";
}

function inferBrowserName(userAgent) {
    const ua = String(userAgent || "").trim();
    if (!ua) return "Unknown";
    if (/edg\//i.test(ua)) return "Edge";
    if (/opr\//i.test(ua)) return "Opera";
    if (/chrome\//i.test(ua) && !/edg\//i.test(ua) && !/opr\//i.test(ua)) return "Chrome";
    if (/firefox\//i.test(ua)) return "Firefox";
    if (/version\//i.test(ua) && /safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
    if (/postmanruntime\//i.test(ua)) return "Postman";
    if (/insomnia\//i.test(ua)) return "Insomnia";
    if (/curl\//i.test(ua)) return "curl";
    if (/node-fetch\//i.test(ua)) return "node-fetch";
    if (/axios\//i.test(ua)) return "axios";
    if (/mozilla\//i.test(ua)) return "Browser";
    return "Unknown";
}

function buildFallbackAction(method, routePath) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const operationByMethod = {
        GET: "read",
        POST: "create",
        PUT: "update",
        PATCH: "update",
        DELETE: "delete",
    };
    const operation = operationByMethod[normalizedMethod] || normalizedMethod.toLowerCase();
    const segments = String(routePath || "")
        .split("?")[0]
        .split("/")
        .filter(Boolean)
        .filter((segment) => segment !== "api")
        .map((segment) => (segment.startsWith(":") ? "item" : segment.replace(/[^a-zA-Z0-9_-]/g, "")));

    if (segments.length === 0) return `http.${operation}`;
    return `${segments.slice(0, 3).join(".")}.${operation}`;
}

function buildTargetDescriptor(req, routePath) {
    const normalizedRoutePath = normalizeRoutePath(routePath, req.originalUrl);
    const params = req.params || {};
    const body = req.body || {};
    const userIdFromParams = Number(params.id || params.userId || 0);
    const targetUserId = Number(body.targetUserId || 0);

    if (normalizedRoutePath === "/api/admin/users/:id" || normalizedRoutePath === "/api/admin/users/:id/password") {
        return { targetUserId: userIdFromParams > 0 ? userIdFromParams : null };
    }
    if (normalizedRoutePath === "/api/coupons/generate") {
        return { targetUserId: targetUserId > 0 ? targetUserId : null };
    }
    if (normalizedRoutePath === "/api/promo/redeem") {
        return { targetUserId: Number(req.user?.sub || 0) || null };
    }
    return { targetUserId: null };
}

function buildRequestMetadata(req, responseBody, routePath, auditContext, durationMs) {
    const metadata = {
        durationMs,
        query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
        params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
        bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body).sort() : undefined,
    };

    const normalizedRoutePath = normalizeRoutePath(routePath, req.originalUrl);

    if (normalizedRoutePath === "/api/coupons/generate") {
        metadata.targetUserId = Number(req.body?.targetUserId || 0) || undefined;
        metadata.packs = Number(req.body?.packs || 0) || undefined;
    }
    if (normalizedRoutePath === "/api/admin/users/:id") {
        metadata.targetUserId = Number(req.params?.id || 0) || undefined;
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, "role")) metadata.role = String(req.body.role || "");
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, "isBlocked")) metadata.isBlocked = Boolean(req.body.isBlocked);
    }
    if (normalizedRoutePath === "/api/admin/users/:id/password") {
        metadata.targetUserId = Number(req.params?.id || 0) || undefined;
    }
    if (normalizedRoutePath === "/api/admin/stickers") {
        metadata.stickerName = truncateText(req.body?.name, 120) || undefined;
        metadata.stickerType = truncateText(req.body?.type, 60) || undefined;
        metadata.teamId = truncateText(req.body?.teamId, 60) || undefined;
    }
    if (normalizedRoutePath === "/api/admin/stickers/:id") {
        metadata.stickerId = truncateText(req.params?.id, 120) || undefined;
        metadata.stickerName = truncateText(req.body?.name, 120) || undefined;
    }

    if (responseBody && typeof responseBody === "object") {
        metadata.error = responseBody;
    }

    if (auditContext && typeof auditContext === "object") {
        if (auditContext.metadata && typeof auditContext.metadata === "object") {
            metadata.context = auditContext.metadata;
        }
        if (auditContext.result && typeof auditContext.result === "object") {
            metadata.result = auditContext.result;
        }
    }

    return metadata;
}

function createAuditLogService({ run, all, nowSqlTimestamp, sanitizeMeta, extractClientIp, logWarn }) {
    const ACTION_MAP = new Map([
        ["POST /api/auth/google", "auth.login.google"],
        ["POST /api/auth/test-login", "auth.login.test"],
        ["POST /api/auth/refresh", "auth.refresh"],
        ["POST /api/auth/logout", "auth.logout"],
        ["GET /api/auth/me", "auth.me.read"],
        ["POST /api/admin/coupons/grant-daily-pack", "admin.coupon.grantDailyPack"],
        ["GET /api/coupons/targets", "coupon.targets.read"],
        ["POST /api/coupons/generate", "coupon.generate"],
        ["POST /api/promo/redeem", "promo.redeem"],
        ["GET /api/admin/coupons", "admin.coupon.list"],
        ["DELETE /api/admin/coupons/:id", "admin.coupon.delete"],
        ["GET /api/admin/users", "admin.user.list"],
        ["GET /api/admin/ranking/completed-audit", "admin.ranking.completedAudit.read"],
        ["GET /api/admin/audit-logs", "admin.audit.read"],
        ["PUT /api/admin/users/:id", "admin.user.update"],
        ["PUT /api/admin/users/:id/password", "admin.user.password.update"],
        ["POST /api/admin/stickers", "admin.sticker.create"],
        ["GET /api/admin/stickers/recent", "admin.sticker.listRecent"],
        ["PUT /api/admin/stickers/:id", "admin.sticker.update"],
        ["DELETE /api/admin/stickers/:id", "admin.sticker.delete"],
    ]);

    function resolveRoutePath(req) {
        const routePath = req.route?.path;
        const baseUrl = String(req.baseUrl || "").trim();
        if (Array.isArray(routePath)) {
            return `${baseUrl}${routePath[0]}`;
        }
        if (typeof routePath === "string" && routePath.trim()) {
            return `${baseUrl}${routePath}`;
        }
        return String(req.originalUrl || "").split("?")[0] || "";
    }

    function resolveAction(req) {
        const auditContext = req.auditContext || {};
        if (auditContext.action) return String(auditContext.action);

        const routePath = resolveRoutePath(req);
        const key = `${String(req.method || "GET").toUpperCase()} ${routePath}`;
        return ACTION_MAP.get(key) || buildFallbackAction(req.method, routePath);
    }

    function resolveAccessChannel(req, browserName) {
        const auditContext = req.auditContext || {};
        if (auditContext.accessChannel) return String(auditContext.accessChannel);

        const normalizedUrl = String(req.originalUrl || "").split("?")[0] || "";
        if (normalizedUrl === "/api/auth/google") return "google_oauth";
        if (normalizedUrl === "/api/auth/test-login") return "test_login";
        if (normalizedUrl === "/api/auth/refresh") return "refresh_token";
        if (normalizedUrl === "/api/auth/logout") return "logout";
        if ((req.headers.authorization || "").startsWith("Bearer ")) return "authenticated_api";
        if (browserName !== "Unknown") return "browser";
        return "api";
    }

    function buildAuditEntry(req, res, responseBody, startedAt) {
        const auditContext = req.auditContext || {};
        const routePath = resolveRoutePath(req);
        const userAgent = truncateText(req.headers["user-agent"], 1000);
        const browserName = auditContext.browserName || inferBrowserName(userAgent);
        const durationMs = Math.max(0, Date.now() - startedAt);
        const actor = {
            userId: Number(req.user?.sub || auditContext.userId || 0) || null,
            userName: truncateText(req.user?.name || auditContext.userName, 120) || null,
            userEmail: truncateText(req.user?.email || auditContext.userEmail, 180) || null,
            userRole: truncateText(req.user?.role || auditContext.userRole, 60) || null,
        };
        const targetDescriptor = buildTargetDescriptor(req, routePath);
        const explicitSuccess = auditContext.success;
        const success = explicitSuccess === undefined ? res.statusCode < 400 : Boolean(explicitSuccess);
        const metadata = buildRequestMetadata(req, responseBody, routePath, auditContext, durationMs);

        return {
            createdAt: nowSqlTimestamp(),
            requestId: truncateText(req.requestId, 64) || null,
            userId: actor.userId,
            userName: actor.userName,
            userEmail: actor.userEmail,
            userRole: actor.userRole,
            action: truncateText(resolveAction(req), 160),
            httpMethod: truncateText(req.method, 16),
            routePath: truncateText(routePath, 255),
            originalUrl: truncateText(String(req.originalUrl || "").split("?")[0], 255),
            statusCode: Number(res.statusCode || 0) || 0,
            clientIp: truncateText(req.clientIp || extractClientIp(req), 120) || "unknown",
            userAgent,
            browserName: truncateText(browserName, 80),
            accessChannel: truncateText(resolveAccessChannel(req, browserName), 80),
            targetUserId: Number(auditContext.targetUserId || targetDescriptor.targetUserId || 0) || null,
            success: success ? 1 : 0,
            metadataJson: JSON.stringify(sanitizeMeta(metadata)),
        };
    }

    function recordRequestAudit(req, res, responseBody, startedAt) {
        const entry = buildAuditEntry(req, res, responseBody, startedAt);
        try {
            return run(
                `INSERT INTO audit_logs(
                    created_at, request_id, user_id, user_name_snapshot, user_email_snapshot, user_role_snapshot,
                    action, http_method, route_path, original_url, status_code, client_ip,
                    user_agent, browser_name, access_channel, target_user_id, success, metadata_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entry.createdAt,
                    entry.requestId,
                    entry.userId,
                    entry.userName,
                    entry.userEmail,
                    entry.userRole,
                    entry.action,
                    entry.httpMethod,
                    entry.routePath,
                    entry.originalUrl,
                    entry.statusCode,
                    entry.clientIp,
                    entry.userAgent,
                    entry.browserName,
                    entry.accessChannel,
                    entry.targetUserId,
                    entry.success,
                    entry.metadataJson,
                ]
            );
        } catch (err) {
            logWarn("Failed to persist audit log", {
                requestId: req.requestId,
                path: req.originalUrl,
                err,
            });
            return null;
        }
    }

    function listAuditLogs(filters = {}) {
        const where = [];
        const params = [];

        const cursorId = Number(filters.cursorId || 0);
        if (cursorId > 0) {
            where.push("id < ?");
            params.push(cursorId);
        }

        const userId = Number(filters.userId || 0);
        if (userId > 0) {
            where.push("user_id = ?");
            params.push(userId);
        }

        const targetUserId = Number(filters.targetUserId || 0);
        if (targetUserId > 0) {
            where.push("target_user_id = ?");
            params.push(targetUserId);
        }

        const action = String(filters.action || "").trim();
        if (action) {
            where.push("action = ?");
            params.push(action);
        }

        const clientIp = String(filters.clientIp || "").trim();
        if (clientIp) {
            where.push("client_ip LIKE ?");
            params.push(`%${clientIp}%`);
        }

        const browserName = String(filters.browserName || "").trim();
        if (browserName) {
            where.push("browser_name = ?");
            params.push(browserName);
        }

        const accessChannel = String(filters.accessChannel || "").trim();
        if (accessChannel) {
            where.push("access_channel = ?");
            params.push(accessChannel);
        }

        const success = String(filters.success || "").trim().toLowerCase();
        if (success === "true" || success === "false") {
            where.push("success = ?");
            params.push(success === "true" ? 1 : 0);
        }

        const from = String(filters.from || "").trim();
        if (from) {
            where.push("created_at >= ?");
            params.push(from);
        }

        const to = String(filters.to || "").trim();
        if (to) {
            where.push("created_at <= ?");
            params.push(to);
        }

        const limit = clampNumber(filters.limit, 1, 200, 50);
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
        const rows = all(
            `SELECT id, created_at, request_id, user_id, user_name_snapshot, user_email_snapshot, user_role_snapshot,
                    action, http_method, route_path, original_url, status_code, client_ip, user_agent,
                    browser_name, access_channel, target_user_id, success, metadata_json
             FROM audit_logs
             ${whereSql}
             ORDER BY id DESC
             LIMIT ?`,
            [...params, limit + 1]
        );

        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit).map((row) => ({
            id: Number(row.id || 0),
            createdAt: row.created_at,
            requestId: row.request_id || "",
            action: row.action || "",
            success: Number(row.success || 0) === 1,
            statusCode: Number(row.status_code || 0),
            actor: {
                userId: row.user_id ? Number(row.user_id) : null,
                name: row.user_name_snapshot || null,
                email: row.user_email_snapshot || null,
                role: row.user_role_snapshot || null,
            },
            targetUserId: row.target_user_id ? Number(row.target_user_id) : null,
            request: {
                method: row.http_method || "",
                routePath: row.route_path || "",
                originalUrl: row.original_url || "",
                clientIp: row.client_ip || "unknown",
                browserName: row.browser_name || "Unknown",
                accessChannel: row.access_channel || "api",
                userAgent: row.user_agent || "",
            },
            metadata: safeParseJson(row.metadata_json, {}),
        }));

        return {
            items,
            pageInfo: {
                limit,
                hasMore,
                nextCursorId: hasMore ? items[items.length - 1]?.id || null : null,
            },
        };
    }

    return {
        inferBrowserName,
        recordRequestAudit,
        listAuditLogs,
    };
}

module.exports = {
    createAuditLogService,
};
