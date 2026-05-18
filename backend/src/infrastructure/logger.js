const fs = require("fs");
const pino = require("pino");
const rfs = require("rotating-file-stream");

const REDACTED = "[REDACTED]";
const MAX_SANITIZE_DEPTH = 8;
const MAX_ARRAY_ITEMS = 60;
const MAX_OBJECT_KEYS = 120;

const SENSITIVE_KEY_PATTERN = /(^|_|-|\.|\[)(authorization|proxyauthorization|cookie|setcookie|password|passwd|pwd|secret|token|jwt|apikey|api_key|accesskey|access_key|privatekey|private_key|credential|session|csrf|xsrf)(_|-|\.|\]|$)/i;
const COOKIE_STRING_PATTERN = /(^|;\s*)[^=;\s]+=[^;]*/;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

function normalizeKey(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(rawKey) {
    if (!rawKey) return false;
    const key = String(rawKey);
    if (SENSITIVE_KEY_PATTERN.test(key)) return true;
    const normalized = normalizeKey(key);
    return [
        "authorization",
        "proxyauthorization",
        "cookie",
        "setcookie",
        "password",
        "newpassword",
        "confirmpassword",
        "accesstoken",
        "refreshtoken",
        "idtoken",
        "jwttoken",
        "jwt",
        "token",
        "apikey",
        "xapikey",
        "clientsecret",
        "clienttoken",
        "secret",
        "privatekey",
        "sessionid",
        "sessiontoken",
    ].includes(normalized);
}

function redactAuthHeader(value) {
    const str = String(value || "").trim();
    if (!str) return REDACTED;
    if (/^bearer\s+/i.test(str)) return "Bearer [REDACTED]";
    if (/^basic\s+/i.test(str)) return "Basic [REDACTED]";
    return REDACTED;
}

function redactCookieString(value) {
    const str = String(value || "").trim();
    if (!str) return REDACTED;
    return str.replace(/(^|;\s*)([^=;\s]+)=([^;]*)/g, "$1$2=[REDACTED]");
}

function sanitizeStringValue(value, parentKey) {
    const str = String(value == null ? "" : value);
    const normalizedKey = normalizeKey(parentKey);

    if (normalizedKey.includes("authorization") || normalizedKey.includes("proxyauthorization")) {
        return redactAuthHeader(str);
    }
    if (normalizedKey.includes("cookie") || normalizedKey.includes("setcookie")) {
        return redactCookieString(str);
    }
    if (isSensitiveKey(parentKey)) {
        return REDACTED;
    }

    let sanitized = str;
    sanitized = sanitized.replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi, "$1 [REDACTED]");
    sanitized = sanitized.replace(/\b(Basic)\s+[A-Za-z0-9+/=]+/gi, "$1 [REDACTED]");
    sanitized = sanitized.replace(JWT_PATTERN, REDACTED);
    if (COOKIE_STRING_PATTERN.test(sanitized) && /(cookie|set-cookie)/i.test(sanitized)) {
        sanitized = redactCookieString(sanitized);
    }
    return truncateValue(sanitized, 4000);
}

function truncateValue(value, max = 1000) {
    const str = String(value == null ? "" : value);
    if (str.length <= max) return str;
    return `${str.slice(0, max)}... [truncated ${str.length - max} chars]`;
}

function normalizeIp(value) {
    const ip = String(value || "").trim();
    if (!ip) return "";
    if (ip.startsWith("::ffff:")) return ip.slice(7);
    return ip;
}

function extractClientIp(req) {
    if (!req || typeof req !== "object") return "unknown";

    const headers = req.headers && typeof req.headers === "object" ? req.headers : {};
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        const firstIp = forwarded.split(",")[0];
        const normalized = normalizeIp(firstIp);
        if (normalized) return normalized;
    }

    const fallbackCandidates = [
        headers["x-real-ip"],
        headers["cf-connecting-ip"],
        headers["true-client-ip"],
        req.ip,
        req.socket?.remoteAddress,
        req.connection?.remoteAddress,
    ];

    for (const candidate of fallbackCandidates) {
        if (!candidate) continue;
        const normalized = normalizeIp(candidate);
        if (normalized) return normalized;
    }

    return "unknown";
}

function sanitizeMeta(meta, options = {}) {
    const { depth = 0, seen = new WeakSet(), parentKey = "" } = options;

    if (meta == null) return null;
    if (depth > MAX_SANITIZE_DEPTH) return "[max-depth]";

    if (typeof meta === "string") {
        return sanitizeStringValue(meta, parentKey);
    }

    if (typeof meta === "number" || typeof meta === "boolean") {
        return meta;
    }

    if (typeof meta === "bigint") {
        return `${meta.toString()}n`;
    }

    if (typeof meta === "function") {
        return `[function ${meta.name || "anonymous"}]`;
    }

    if (typeof meta === "symbol") {
        return String(meta);
    }

    if (meta instanceof Date) {
        return Number.isNaN(meta.getTime()) ? "[invalid-date]" : meta.toISOString();
    }

    if (Buffer.isBuffer(meta)) {
        return `[buffer ${meta.length} bytes]`;
    }

    if (meta instanceof Error) {
        return {
            name: meta.name,
            message: sanitizeStringValue(meta.message, "errorMessage"),
            stack: truncateValue(meta.stack || "", 4000),
            cause: meta.cause ? sanitizeMeta(meta.cause, { depth: depth + 1, seen, parentKey: "cause" }) : undefined,
        };
    }

    if (Array.isArray(meta)) {
        return meta.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeMeta(item, {
            depth: depth + 1,
            seen,
            parentKey,
        }));
    }

    if (typeof meta === "object") {
        if (seen.has(meta)) return "[circular]";
        seen.add(meta);

        const output = {};
        const entries = Object.entries(meta).slice(0, MAX_OBJECT_KEYS);
        for (const [key, value] of entries) {
            if (isSensitiveKey(key)) {
                if (/authorization/i.test(key)) {
                    output[key] = redactAuthHeader(value);
                } else if (/cookie|set-cookie/i.test(key)) {
                    output[key] = redactCookieString(value);
                } else {
                    output[key] = REDACTED;
                }
                continue;
            }

            output[key] = sanitizeMeta(value, {
                depth: depth + 1,
                seen,
                parentKey: key,
            });
        }

        return output;
    }

    return truncateValue(meta, 4000);
}

function createAppLogger({
    logLevel,
    nodeEnv,
    logRotationEnabled,
    logDir,
    logRotationInterval,
    logRotationMaxFiles,
}) {
    const pinoStreams = [{ level: logLevel, stream: process.stdout }];
    let fileLogEnabled = false;

    if (logRotationEnabled) {
        try {
            fs.mkdirSync(logDir, { recursive: true });
            const rotatingFileStream = rfs.createStream("backend.log", {
                interval: logRotationInterval,
                path: logDir,
                compress: "gzip",
                maxFiles: Number.isFinite(logRotationMaxFiles) && logRotationMaxFiles > 0
                    ? logRotationMaxFiles
                    : 14,
            });
            pinoStreams.push({ level: logLevel, stream: rotatingFileStream });
            fileLogEnabled = true;
        } catch (err) {
            console.error("Falha ao configurar log rotativo em arquivo. Seguindo apenas com stdout.", err);
        }
    }

    const logger = pino(
        {
            level: logLevel,
            base: {
                service: "album-backend",
                env: nodeEnv,
            },
            redact: {
                paths: [
                    "req.headers.authorization",
                    "req.headers.proxy-authorization",
                    "req.headers.cookie",
                    "req.headers.set-cookie",
                    "req.headers.x-api-key",
                    "req.cookies",
                    "req.signedCookies",
                    "headers.authorization",
                    "headers.proxy-authorization",
                    "headers.cookie",
                    "headers.set-cookie",
                    "headers.x-api-key",
                    "authorization",
                    "cookie",
                    "set-cookie",
                    "password",
                    "newPassword",
                    "confirmPassword",
                    "clientSecret",
                    "accessToken",
                    "refreshToken",
                    "idToken",
                    "jwt",
                    "token",
                    "apiKey",
                    "xApiKey",
                    "secret",
                ],
                remove: true,
            },
        },
        pino.multistream(pinoStreams)
    );

    function logDebug(message, meta) {
        logger.debug({ meta: sanitizeMeta(meta) }, truncateValue(message, 2000));
    }

    function logInfo(message, meta) {
        logger.info({ meta: sanitizeMeta(meta) }, truncateValue(message, 2000));
    }

    function logWarn(message, meta) {
        logger.warn({ meta: sanitizeMeta(meta) }, truncateValue(message, 2000));
    }

    function logError(message, meta) {
        logger.error({ meta: sanitizeMeta(meta) }, truncateValue(message, 2000));
    }

    return {
        logger,
        fileLogEnabled,
        logDebug,
        logInfo,
        logWarn,
        logError,
        sanitizeMeta,
        extractClientIp,
    };
}

module.exports = { createAppLogger };
