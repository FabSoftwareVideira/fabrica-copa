const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const pinoHttp = require("pino-http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const swaggerUi = require("swagger-ui-express");
const { OAuth2Client } = require("google-auth-library");

const { createSqliteHelpers } = require("./infrastructure/sqlite");
const { createSwaggerSpec } = require("./infrastructure/swagger");
const { createAppLogger } = require("./infrastructure/logger");
const { initDatabase } = require("./infrastructure/databaseInit");
const { createAuthController } = require("./controllers/authController");
const { createSystemController } = require("./controllers/systemController");
const { createTradeAvailabilityService } = require("./services/tradeAvailabilityService");
const { createAuthMiddleware, requireRoles } = require("./middlewares/auth");
const { parseJSON } = require("./utils/json");
const { normalizeCode } = require("./utils/text");
const { createDateTimeUtils } = require("./utils/dateTime");
const { createCorsOptions } = require("./utils/cors");
const { createSystemRoutes } = require("./routes/systemRoutes");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createAlbumRoutes } = require("./routes/albumRoutes");
const { createAdminRoutes } = require("./routes/adminRoutes");
const { createAlbumStateRoutes } = require("./routes/albumStateRoutes");
const { createTradeRoutes } = require("./routes/tradeRoutes");
const { createStickerCatalogService } = require("./services/stickerCatalogService");
const {
    NODE_ENV,
    PORT,
    APP_TIMEZONE,
    CORS_ORIGIN,
    JWT_SECRET,
    ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL_DAYS,
    GOOGLE_CLIENT_ID,
    LOG_LEVEL,
    LOG_ROTATION_ENABLED,
    LOG_DIR,
    LOG_ROTATION_INTERVAL,
    LOG_ROTATION_MAX_FILES,
    API_BASE_URL,
    DB_PATH,
    ROLE_ADMIN,
    ROLE_SERVIDOR,
    ROLE_PLAYER,
    ALLOWED_ROLES,
} = require("./config/env");

const db = new sqlite3.Database(DB_PATH);
const { run, get, all, ensureColumn } = createSqliteHelpers(db);

const { todayStr, addDaysISO, nowSqlTimestamp } = createDateTimeUtils(APP_TIMEZONE);
const corsOptions = createCorsOptions(CORS_ORIGIN);
const app = express();
app.set("trust proxy", true);
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

const { logger, fileLogEnabled, logInfo, logWarn, logError, sanitizeMeta, extractClientIp } = createAppLogger({
    logLevel: LOG_LEVEL,
    nodeEnv: NODE_ENV,
    logRotationEnabled: LOG_ROTATION_ENABLED,
    logDir: LOG_DIR,
    logRotationInterval: LOG_ROTATION_INTERVAL,
    logRotationMaxFiles: LOG_ROTATION_MAX_FILES,
});

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
const getCustomStickers = stickerCatalog.getCustomStickers;
const setCustomStickers = stickerCatalog.setCustomStickers;
const normalizeSticker = stickerCatalog.normalizeSticker;
const rebuildStickerCatalog = stickerCatalog.rebuildStickerCatalog;
const loadCustomStickersFromDb = stickerCatalog.loadCustomStickersFromDb;
const findTeamMeta = stickerCatalog.findTeamMeta;
const saveStickerImageToUploads = stickerCatalog.saveStickerImageToUploads;
const removeUploadedStickerImage = stickerCatalog.removeUploadedStickerImage;

const swaggerSpec = createSwaggerSpec(API_BASE_URL);
const systemController = createSystemController({
    NODE_ENV,
    STICKERS,
    logWarn,
    logInfo,
    logError,
});

const authMiddleware = createAuthMiddleware({
    get,
    jwt,
    JWT_SECRET,
    ROLE_PLAYER,
});

const authController = createAuthController({
    get,
    run,
    nowSqlTimestamp,
    sanitizeUser,
    verifyGoogleIdToken,
    roleFromGoogleEmail,
    ROLE_PLAYER,
    signAccessToken,
    createRefreshToken,
    revokeRefreshToken,
    jwt,
    JWT_SECRET,
    ACCESS_TOKEN_TTL,
    bcrypt,
    crypto,
});

function signAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
}

function roleFromGoogleEmail(email, currentRole = ROLE_PLAYER) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (cleanEmail.endsWith("@ifc.edu.br")) {
        if (currentRole === ROLE_ADMIN) return ROLE_ADMIN;
        return ROLE_SERVIDOR;
    }
    return currentRole || ROLE_PLAYER;
}

async function verifyGoogleIdToken(idToken) {
    if (!GOOGLE_CLIENT_ID) {
        const err = new Error("GOOGLE_CLIENT_ID nao configurado no backend");
        err.code = "GOOGLE_CONFIG_MISSING";
        throw err;
    }

    const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
    });

    return ticket.getPayload() || {};
}

function makeRefreshToken() {
    return crypto.randomBytes(48).toString("hex");
}

async function createRefreshToken(userId) {
    const token = makeRefreshToken();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = addDaysISO(REFRESH_TOKEN_TTL_DAYS);
    const createdAt = nowSqlTimestamp();

    await run(
        `INSERT INTO refresh_tokens(user_id, token_hash, expires_at, revoked, created_at)
     VALUES(?, ?, ?, 0, ?)`,
        [userId, tokenHash, expiresAt, createdAt]
    );

    return token;
}

async function revokeRefreshToken(rawToken) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
}

function sanitizeUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || ROLE_PLAYER,
        isBlocked: Number(row.is_blocked || 0) === 1,
    };
}

async function getAlbumState(userId) {
    let row = await get("SELECT * FROM album_states WHERE user_id = ?", [userId]);
    if (!row) {
        await run("INSERT INTO album_states(user_id) VALUES(?)", [userId]);
        row = await get("SELECT * FROM album_states WHERE user_id = ?", [userId]);
    }

    return {
        row,
        state: {
            collected: parseJSON(row.collected_json || "{}", {}),
            packsUsedDate: row.packs_used_date || "",
            packsUsedToday: row.packs_used_today || 0,
            extraPacks: row.extra_packs || 0,
            tradeCoins: Number(row.trade_coins || 0),
            usedCodes: parseJSON(row.used_codes_json || "[]", []),
        },
    };
}

function countCollectedStickers(collectedMap) {
    if (!collectedMap || typeof collectedMap !== "object") return 0;
    return Object.entries(collectedMap).reduce((acc, [stickerId, count]) => {
        if (!STICKER_BY_ID.has(String(stickerId))) return acc;
        return acc + (Number(count) >= 1 ? 1 : 0);
    }, 0);
}

function toRankingRows(rows) {
    const totalStickers = Math.max(0, Number(STICKERS.length || 0));
    const ranked = (Array.isArray(rows) ? rows : [])
        .map((row) => {
            const collectedMap = parseJSON(row.collected_json || "{}", {});
            const collected = countCollectedStickers(collectedMap);
            const percent =
                totalStickers > 0
                    ? Math.min(100, Math.round((collected / totalStickers) * 100))
                    : 0;

            return {
                userId: Number(row.id || 0),
                name: String(row.name || "Usuário"),
                collected,
                percent,
                updatedAt: String(row.updated_at || ""),
            };
        })
        .sort((a, b) => {
            if (b.collected !== a.collected) return b.collected - a.collected;
            if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) {
                return a.updatedAt.localeCompare(b.updatedAt);
            }
            return a.name.localeCompare(b.name, "pt-BR");
        });

    let lastCollected = null;
    let currentPosition = 0;
    for (let idx = 0; idx < ranked.length; idx += 1) {
        if (lastCollected === null || ranked[idx].collected !== lastCollected) {
            currentPosition = idx + 1;
            lastCollected = ranked[idx].collected;
        }
        ranked[idx].position = currentPosition;
    }

    return ranked;
}

async function getGlobalRanking() {
    const rows = await all(
        `SELECT u.id, u.name, u.is_blocked, a.collected_json, a.updated_at
         FROM users u
         LEFT JOIN album_states a ON a.user_id = u.id
         WHERE u.is_blocked = 0`
    );
    return toRankingRows(rows);
}

async function rebuildCollectedFromPackHistory(userId) {
    const rows = await all(
        `SELECT stickers_json FROM pack_history WHERE user_id = ? ORDER BY id ASC`,
        [userId]
    );

    const collected = {};
    for (const row of rows) {
        const stickers = parseJSON(row.stickers_json || "[]", []);
        for (const sticker of stickers) {
            const stickerId = String(sticker?.id || "");
            if (!stickerId || !STICKER_BY_ID.has(stickerId)) continue;
            collected[stickerId] = (collected[stickerId] || 0) + 1;
        }
    }

    return collected;
}

async function getValidCollectedMap(userId) {
    const collected = await rebuildCollectedFromPackHistory(userId);

    const tradeHistoryRows = await all(
        `SELECT offered_sticker_id, requested_sticker_id FROM trade_history WHERE user_id = ? ORDER BY id ASC`,
        [userId]
    );

    for (const trade of tradeHistoryRows) {
        const offeredId = String(trade.offered_sticker_id || "");
        const requestedId = String(trade.requested_sticker_id || "");
        if (offeredId && STICKER_BY_ID.has(offeredId)) {
            collected[offeredId] = Math.max(0, (collected[offeredId] || 0) - 1);
        }
        if (requestedId && STICKER_BY_ID.has(requestedId)) {
            collected[requestedId] = (collected[requestedId] || 0) + 1;
        }
    }

    return collected;
}

const tradeAvailabilityService = createTradeAvailabilityService({
    all,
    getValidCollectedMap,
    stickers: STICKERS,
});
const {
    TRADE_AVAILABLE_LIMIT,
    TRADE_AVAILABLE_REROLL_COST,
    buildTradeAvailableEntries,
    pickTradeAvailableSelection,
    getCachedTradeAvailableSelection,
    setCachedTradeAvailableSelection,
} = tradeAvailabilityService;
const TRADE_COINS_PER_TRADE = 3;

async function getAllTradeWindows() {
    const rows = await all(
        `SELECT tw.id, tw.starts_at, tw.ends_at, tw.created_by_user_id, tw.created_at, tw.updated_at,
                u.name as created_by_user_name
         FROM trade_window_config tw
         LEFT JOIN users u ON u.id = tw.created_by_user_id
         ORDER BY tw.starts_at ASC`
    );
    return Array.isArray(rows) ? rows : [];
}

function toTradeWindowRowPayload(row) {
    if (!row || !row.starts_at || !row.ends_at) {
        return null;
    }

    const startMs = new Date(row.starts_at).getTime();
    const endMs = new Date(row.ends_at).getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        return null;
    }

    const nowMs = Date.now();
    const isOpen = nowMs >= startMs && nowMs <= endMs;

    return {
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isOpen,
        createdByUserId: row.created_by_user_id,
        createdByUserName: row.created_by_user_name || "Admin",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toTradeWindowsPayload(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => toTradeWindowRowPayload(r)).filter(p => p !== null);
}

function isAnyTradeWindowOpen(windows) {
    if (!Array.isArray(windows)) return false;
    return windows.some(w => w && w.isOpen === true);
}

async function requireTradeWindowOpen(req, res, next) {
    try {
        const allWindows = await getAllTradeWindows();
        const windows = toTradeWindowsPayload(allWindows);
        if (!isAnyTradeWindowOpen(windows)) {
            return res.status(403).json({
                error: "A janela de trocas esta fechada no momento",
                code: "TRADE_WINDOW_CLOSED",
                tradeWindows: windows,
            });
        }
        req.tradeWindows = windows;
        return next();
    } catch (err) {
        return res.status(500).json({ error: "Erro ao validar janela de trocas", detail: err.message });
    }
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// Peso menor para figurinhas especiais: 10% da chance de uma figurinha normal.
const ESPECIAL_WEIGHT = 0.1;

function pickRandomWeighted(list) {
    const weights = list.map((s) => (s.section === "especial" ? ESPECIAL_WEIGHT : 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
    }
    return list[list.length - 1];
}

async function initDb() {
    await initDatabase({ run, get, all, ensureColumn, logInfo });
}

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Album Copa 2026 - API Docs",
}));
app.use("/api", createSystemRoutes({ systemController, swaggerSpec }));
app.use("/api", createAuthRoutes({ authController, authMiddleware }));
app.use("/api", createAlbumRoutes({
    authMiddleware,
    requireRoles,
    ROLE_ADMIN,
    APP_TIMEZONE,
    STICKERS,
    getGlobalRanking,
    getAllTradeWindows,
    toTradeWindowsPayload,
    run,
    get,
    nowSqlTimestamp,
}));
app.use("/api", createAdminRoutes({
    authMiddleware,
    requireRoles,
    ROLE_ADMIN,
    ROLE_SERVIDOR,
    ROLE_PLAYER,
    ALLOWED_ROLES,
    STICKERS,
    PROMO_CODES,
    run,
    get,
    all,
    nowSqlTimestamp,
    todayStr,
    normalizeCode,
    getAlbumState,
    sanitizeUser,
    findTeamMeta,
    saveStickerImageToUploads,
    removeUploadedStickerImage,
    normalizeSticker,
    rebuildStickerCatalog,
    getCustomStickers,
    setCustomStickers,
}));
app.use("/api", createAlbumStateRoutes({
    authMiddleware,
    STICKERS,
    STICKER_BY_ID,
    getAlbumState,
    getValidCollectedMap,
    nowSqlTimestamp,
    run,
    all,
    parseJSON,
    pickRandomWeighted,
    getAllTradeWindows,
    toTradeWindowsPayload,
}));
app.use("/api", createTradeRoutes({
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
    TRADE_COINS_PER_TRADE,
    TRADE_AVAILABLE_LIMIT,
    TRADE_AVAILABLE_REROLL_COST,
    buildTradeAvailableEntries,
    getCachedTradeAvailableSelection,
    pickTradeAvailableSelection,
    setCachedTradeAvailableSelection,
}));

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
app.use(morgan(":date[iso] :request-id :client-ip :method :url :status :res[content-length] - :response-time ms", {
    stream: {
        write: (message) => {
            logger.info({ type: "http_access" }, message.trim());
        },
    },
    skip: (req) => req.originalUrl === "/api/health",
}));

app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 400) {
            req.log?.warn(
                {
                    requestId: req.requestId,
                    clientIp: req.clientIp || extractClientIp(req),
                    method: req.method,
                    path: req.originalUrl,
                    remoteAddress: req.ip || req.socket?.remoteAddress || "",
                    status: res.statusCode,
                    responseBody: sanitizeMeta(body),
                },
                "HTTP response with error payload"
            );
        }
        return originalJson(body);
    };

    next();
});

app.use((err, req, res, _next) => {
    logError("Unhandled express error", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        err,
    });

    return res.status(500).json({
        error: "Erro interno do servidor",
        requestId: req.requestId,
    });
});

process.on("unhandledRejection", (reason) => {
    logError("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (err) => {
    logError("Uncaught exception", { err });
});

// ---------- Trade window state watcher ----------
// Tracks which window IDs are currently open and when they opened (to detect open/close transitions)
// windowId -> { isOpen: boolean, openedAt: timestamp }
const tradeWindowOpenStates = new Map();

async function checkTradeWindowTransitions() {
    try {
        const rows = await getAllTradeWindows();
        const windows = toTradeWindowsPayload(rows);
        const now = nowSqlTimestamp();

        for (const w of windows) {
            const prevState = tradeWindowOpenStates.get(w.id);
            const wasOpen = prevState?.isOpen ?? false;
            const isNowOpen = w.isOpen === true;

            if (prevState === undefined) {
                // First check after startup — just record state, no event
                if (isNowOpen) {
                    tradeWindowOpenStates.set(w.id, { isOpen: true, openedAt: now });
                } else {
                    tradeWindowOpenStates.set(w.id, { isOpen: false, openedAt: null });
                }
                continue;
            }

            if (!wasOpen && isNowOpen) {
                // Window just opened — record the exact moment it opened
                tradeWindowOpenStates.set(w.id, { isOpen: true, openedAt: now });
                const endsAtFormatted = new Date(w.endsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: APP_TIMEZONE });
                const msg = `A janela de trocas foi aberta (até ${endsAtFormatted}).`;
                await run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('trade_window_opened', ?, ?, NULL, NULL, ?)`,
                    [msg, JSON.stringify({ windowId: w.id, startsAt: w.startsAt, endsAt: w.endsAt }), now]
                );
            } else if (wasOpen && !isNowOpen) {
                // Window just closed — cancel ALL pending offers (window ended, so all pending trades are void)
                tradeWindowOpenStates.set(w.id, { isOpen: false, openedAt: null });

                // Get all PENDING offers (regardless of when created — the window is closed)
                const pendingOffers = await all(
                    `SELECT id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id
                     FROM trade_offers
                     WHERE status = 'pending'`
                );

                // Cancel all pending offers and create notifications
                for (const offer of pendingOffers) {
                    await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [now, offer.id]);

                    // Notify both users that the offer was cancelled
                    const offeredSticker = STICKER_BY_ID.get(offer.offered_sticker_id);
                    const requestedSticker = STICKER_BY_ID.get(offer.requested_sticker_id);
                    const notificationPayload = {
                        offerId: offer.id,
                        offeredStickerId: offer.offered_sticker_id,
                        offeredStickerNum: offeredSticker?.num || "?",
                        requestedStickerId: offer.requested_sticker_id,
                        requestedStickerNum: requestedSticker?.num || "?",
                        reason: "window_closed",
                    };

                    // Notify initiator
                    await run(
                        `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                         VALUES('trade_offer_cancelled', ?, ?, ?, ?, ?)`,
                        ["trade_offer_cancelled", JSON.stringify(notificationPayload), offer.from_user_id, offer.from_user_id, now]
                    );

                    // Notify receiver
                    await run(
                        `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                         VALUES('trade_offer_cancelled', ?, ?, ?, ?, ?)`,
                        ["trade_offer_cancelled", JSON.stringify(notificationPayload), offer.from_user_id, offer.to_user_id, now]
                    );
                }

                const msg = `A janela de trocas foi encerrada. ${pendingOffers.length} oferta(s) pendente(s) cancelada(s).`;
                await run(
                    `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                     VALUES('trade_window_closed', ?, ?, NULL, NULL, ?)`,
                    [msg, JSON.stringify({ windowId: w.id, startsAt: w.startsAt, endsAt: w.endsAt, cancelledOffers: pendingOffers.length }), now]
                );
            }
        }

        // Clean up entries for windows that no longer exist
        const activeIds = new Set(windows.map(w => w.id));
        for (const id of tradeWindowOpenStates.keys()) {
            if (!activeIds.has(id)) tradeWindowOpenStates.delete(id);
        }
    } catch (err) {
        logError("Erro ao verificar transições de janela de trocas", { err });
    }
}

let tradeWindowWatcherTimer = null;

async function initializeApplication() {
    await initDb();
    await loadCustomStickersFromDb();
    await checkTradeWindowTransitions();

    if (!tradeWindowWatcherTimer) {
        tradeWindowWatcherTimer = setInterval(checkTradeWindowTransitions, 30_000);
    }
}

function getServerConfig() {
    return {
        PORT,
        NODE_ENV,
        LOG_LEVEL,
        fileLogEnabled,
        LOG_DIR,
        LOG_ROTATION_INTERVAL,
        CORS_ORIGIN,
    };
}

module.exports = {
    app,
    initializeApplication,
    getServerConfig,
    logInfo,
    logError,
};
