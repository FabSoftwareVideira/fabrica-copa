"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const pinoHttp = require("pino-http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createSqliteHelpers, Database } = require("./infrastructure/sqlite");
const swaggerUi = require("swagger-ui-express");
const { OAuth2Client } = require("google-auth-library");

// Infrastructure
const { createSwaggerSpec } = require("./infrastructure/swagger");
const { createAppLogger } = require("./infrastructure/logger");
const { initDatabase } = require("./infrastructure/databaseInit");

// Config
const {
    NODE_ENV, PORT, APP_TIMEZONE, CORS_ORIGIN, JWT_SECRET,
    ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, GOOGLE_CLIENT_ID,
    LOG_LEVEL, LOG_ROTATION_ENABLED, LOG_DIR, LOG_ROTATION_INTERVAL,
    LOG_ROTATION_MAX_FILES, DAILY_LOGIN_BONUS_COINS, DAILY_LOGIN_BONUS_PACKS,
    API_BASE_URL, DB_PATH,
    ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER, ALLOWED_ROLES,
} = require("./config/env");

// Utils
const { parseJSON } = require("./utils/json");
const { normalizeCode } = require("./utils/text");
const { createDateTimeUtils } = require("./utils/dateTime");
const { createCorsOptions } = require("./utils/cors");
const { pickRandomWeighted } = require("./utils/packPicker");
const { createGoogleAuthUtils } = require("./utils/googleAuth");

// Services
const { createTokenService } = require("./services/tokenService");
const { createAlbumService } = require("./services/albumService");
const { createRankingService } = require("./services/rankingService");
const { createTradeWindowService } = require("./services/tradeWindowService");
const { createTradeWindowWatcher } = require("./services/tradeWindowWatcher");
const { createStickerCatalogService } = require("./services/stickerCatalogService");
const { createTradeAvailabilityService } = require("./services/tradeAvailabilityService");

// Middlewares
const { createAuthMiddleware, requireRoles } = require("./middlewares/auth");

// Controllers
const { createAuthController } = require("./controllers/authController");
const { createSystemController } = require("./controllers/systemController");

// Routes
const { createSystemRoutes } = require("./routes/systemRoutes");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createAlbumRoutes } = require("./routes/albumRoutes");
const { createAdminRoutes } = require("./routes/adminRoutes");
const { createAlbumStateRoutes } = require("./routes/albumStateRoutes");
const { createTradeRoutes } = require("./routes/tradeRoutes");

// ─── Database ────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
const { run, get, all, ensureColumn, transaction } = createSqliteHelpers(db);

// ─── Shared utilities ────────────────────────────────────────────────────────

const { todayStr, addDaysISO, nowSqlTimestamp } = createDateTimeUtils(APP_TIMEZONE);
const corsOptions = createCorsOptions(CORS_ORIGIN);

// ─── Logger ──────────────────────────────────────────────────────────────────

const { logger, fileLogEnabled, logInfo, logWarn, logError, sanitizeMeta, extractClientIp } = createAppLogger({
    logLevel: LOG_LEVEL,
    nodeEnv: NODE_ENV,
    logRotationEnabled: LOG_ROTATION_ENABLED,
    logDir: LOG_DIR,
    logRotationInterval: LOG_ROTATION_INTERVAL,
    logRotationMaxFiles: LOG_ROTATION_MAX_FILES,
});

// ─── Sticker catalog ─────────────────────────────────────────────────────────

const uploadsDir = path.resolve(__dirname, "../uploads");
const PROMO_CODES = parseJSON(process.env.PROMO_CODES_JSON || "{}", {});

const stickerCatalog = createStickerCatalogService({
    dataScriptPath: path.resolve(__dirname, "../../frontend/js/data.js"),
    uploadsRootDir: uploadsDir,
    nowSqlTimestamp,
    all,
    logWarn,
});

const ALBUM_DATA = stickerCatalog.getAlbumData();
const STICKERS = stickerCatalog.getStickers();
const STICKER_BY_ID = stickerCatalog.getStickerByIdMap();
const {
    getCustomStickers, setCustomStickers, normalizeSticker,
    rebuildStickerCatalog, loadCustomStickersFromDb,
    findTeamMeta, saveStickerImageToUploads, removeUploadedStickerImage,
} = stickerCatalog;

// ─── Domain services ─────────────────────────────────────────────────────────

const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

const { verifyGoogleIdToken, roleFromGoogleEmail } = createGoogleAuthUtils({
    googleOAuthClient, GOOGLE_CLIENT_ID, ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER,
});

const { signAccessToken, createRefreshToken, revokeRefreshToken } = createTokenService({
    run, jwt, JWT_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS,
    crypto, addDaysISO, nowSqlTimestamp,
});

const { getAlbumState, getValidCollectedMap } = createAlbumService({
    run, get, all, STICKER_BY_ID, parseJSON,
});

const { getGlobalRanking } = createRankingService({
    all, STICKERS, STICKER_BY_ID, parseJSON,
});

const { getAllTradeWindows, toTradeWindowsPayload, requireTradeWindowOpen } = createTradeWindowService({ all });

const tradeAvailabilityService = createTradeAvailabilityService({
    all, getValidCollectedMap, stickers: STICKERS,
});
const {
    TRADE_AVAILABLE_LIMIT, TRADE_AVAILABLE_REROLL_COST,
    buildTradeAvailableEntries, pickTradeAvailableSelection,
    getCachedTradeAvailableSelection, setCachedTradeAvailableSelection,
} = tradeAvailabilityService;

const TRADE_COINS_PER_TRADE = 3;

// ─── Swagger & controllers ───────────────────────────────────────────────────

const swaggerSpec = createSwaggerSpec(API_BASE_URL);

const systemController = createSystemController({ NODE_ENV, STICKERS, logWarn, logInfo, logError });

const authMiddleware = createAuthMiddleware({ get, jwt, JWT_SECRET, ROLE_PLAYER });

function sanitizeUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || ROLE_PLAYER,
        isBlocked: Number(row.is_blocked || 0) === 1,
    };
}

const authController = createAuthController({
    get, run, nowSqlTimestamp, sanitizeUser, verifyGoogleIdToken, roleFromGoogleEmail,
    ROLE_PLAYER, signAccessToken, createRefreshToken, revokeRefreshToken,
    jwt, JWT_SECRET, ACCESS_TOKEN_TTL, bcrypt, crypto,
    todayStr, DAILY_LOGIN_BONUS_COINS, DAILY_LOGIN_BONUS_PACKS,
});

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", true);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir)); // Alias for uploads, for easier client access

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Album Copa 2026 - API Docs",
}));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/api", createSystemRoutes({ systemController, swaggerSpec }));
app.use("/api", createAuthRoutes({ authController, authMiddleware }));
app.use("/api", createAlbumRoutes({
    authMiddleware, requireRoles, ROLE_ADMIN, APP_TIMEZONE, STICKERS,
    getGlobalRanking, getAllTradeWindows, toTradeWindowsPayload, run, get, nowSqlTimestamp,
}));
app.use("/api", createAdminRoutes({
    authMiddleware, requireRoles, ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER, ALLOWED_ROLES,
    STICKERS, PROMO_CODES, run, get, all, nowSqlTimestamp, todayStr, normalizeCode,
    getAlbumState, sanitizeUser, findTeamMeta, saveStickerImageToUploads,
    removeUploadedStickerImage, normalizeSticker, rebuildStickerCatalog,
    getCustomStickers, setCustomStickers, API_BASE_URL,
}));
app.use("/api", createAlbumStateRoutes({
    authMiddleware, STICKERS, STICKER_BY_ID, getAlbumState, getValidCollectedMap,
    nowSqlTimestamp, run, all, parseJSON, pickRandomWeighted,
    getAllTradeWindows, toTradeWindowsPayload,
}));
app.use("/api", createTradeRoutes({
    authMiddleware, requireTradeWindowOpen, STICKERS, STICKER_BY_ID, getValidCollectedMap,
    all, get, run, nowSqlTimestamp, getAlbumState, TRADE_COINS_PER_TRADE,
    TRADE_AVAILABLE_LIMIT, TRADE_AVAILABLE_REROLL_COST,
    buildTradeAvailableEntries, getCachedTradeAvailableSelection,
    pickTradeAvailableSelection, setCachedTradeAvailableSelection,
    transaction
}));

// ─── HTTP logging middlewares (after routes so requestId is set) ──────────────

app.use((req, res, next) => {
    req.requestId = req.requestId || crypto.randomBytes(6).toString("hex");
    req.clientIp = extractClientIp(req);
    res.setHeader("x-request-id", req.requestId);
    next();
});

app.use(pinoHttp({
    logger,
    genReqId: (req) => req.requestId || crypto.randomBytes(6).toString("hex"),
    autoLogging: false,
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
    customProps: (req) => ({ requestId: req.requestId, clientIp: req.clientIp || extractClientIp(req) }),
}));

morgan.token("request-id", (req) => req.requestId || "-");
morgan.token("client-ip", (req) => req.clientIp || extractClientIp(req));
app.use(morgan(
    ":date[iso] :request-id :client-ip :method :url :status :res[content-length] - :response-time ms",
    {
        stream: { write: (msg) => logger.info({ type: "http_access" }, msg.trim()) },
        skip: (req) => req.originalUrl === "/api/health",
    }
));

// Log bodies of error responses
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 400) {
            req.log?.warn({
                requestId: req.requestId,
                clientIp: req.clientIp || extractClientIp(req),
                method: req.method,
                path: req.originalUrl,
                remoteAddress: req.ip || req.socket?.remoteAddress || "",
                status: res.statusCode,
                responseBody: sanitizeMeta(body),
            }, "HTTP response with error payload");
        }
        return originalJson(body);
    };
    next();
});

// Global error handler
app.use((err, req, res, _next) => {
    logError("Unhandled express error", { requestId: req.requestId, method: req.method, path: req.originalUrl, err });
    return res.status(500).json({ error: "Erro interno do servidor", requestId: req.requestId });
});

// ─── Process-level error guards ──────────────────────────────────────────────

process.on("unhandledRejection", (reason) => logError("Unhandled promise rejection", { reason }));
process.on("uncaughtException", (err) => logError("Uncaught exception", { err }));

// ─── Application bootstrap ───────────────────────────────────────────────────

const tradeWindowWatcher = createTradeWindowWatcher({
    run, all, getAllTradeWindows, toTradeWindowsPayload,
    STICKER_BY_ID, APP_TIMEZONE, nowSqlTimestamp, logError,
});

async function initializeApplication() {
    await initDatabase({ run, get, all, ensureColumn, logInfo });
    await loadCustomStickersFromDb();
    await tradeWindowWatcher.start();
}

function getServerConfig() {
    return { PORT, NODE_ENV, LOG_LEVEL, fileLogEnabled, LOG_DIR, LOG_ROTATION_INTERVAL, CORS_ORIGIN };
}

module.exports = { app, initializeApplication, getServerConfig, logInfo, logError };