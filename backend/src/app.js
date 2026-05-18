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

app.get("/api/stickers/catalog", async (_req, res) => {
    return res.json({ stickers: STICKERS, total: STICKERS.length });
});

app.get("/api/album/state", authMiddleware, async (req, res) => {
    try {
        const { state, row } = await getAlbumState(req.user.sub);
        // Always derive collected from source-of-truth (pack history + trade history)
        // to ensure stickers from trades are never stale/pending.
        const validCollected = await getValidCollectedMap(req.user.sub);
        const nowTimestamp = nowSqlTimestamp();
        await run(
            "UPDATE album_states SET collected_json = ?, updated_at = ? WHERE user_id = ?",
            [JSON.stringify(validCollected), nowTimestamp, req.user.sub]
        );
        const allWindows = await getAllTradeWindows();
        const tradeWindows = toTradeWindowsPayload(allWindows);
        return res.json({
            ...state,
            collected: validCollected,
            tradeWindows,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar estado", detail: err.message });
    }
});

app.put("/api/album/state", authMiddleware, async (req, res) => {
    try {
        const { row } = await getAlbumState(req.user.sub);
        const updatedAt = nowSqlTimestamp();

        const validatedCollected = await getValidCollectedMap(req.user.sub);

        await run(
            `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          trade_coins = ?,
          used_codes_json = ?,
          updated_at = ?
      WHERE user_id = ?
      `,
            [
                JSON.stringify(validatedCollected),
                row.packs_used_date || "",
                row.packs_used_today || 0,
                row.extra_packs || 0,
                Number(row.trade_coins || 0),
                row.used_codes_json || "[]",
                updatedAt,
                req.user.sub,
            ]
        );

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao salvar estado", detail: err.message });
    }
});

app.get("/api/system/events", authMiddleware, async (req, res) => {
    try {
        const sinceId = Math.max(0, Number(req.query.sinceId || 0));
        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));

        const rows = await all(
            `SELECT id, event_type, message, payload_json, created_by_user_id, target_user_id, created_at
             FROM system_events
             WHERE id > ?
               AND (target_user_id IS NULL OR target_user_id = ?)
             ORDER BY id ASC
             LIMIT ?`,
            [sinceId, req.user.sub, limit]
        );

        const events = rows.map((r) => ({
            id: r.id,
            type: r.event_type,
            message: r.message,
            payload: parseJSON(r.payload_json || "{}", {}),
            createdByUserId: r.created_by_user_id,
            targetUserId: r.target_user_id || null,
            createdAt: r.created_at,
        }));

        const lastEventId = events.length ? events[events.length - 1].id : sinceId;
        return res.json({ events, lastEventId });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar notificacoes", detail: err.message });
    }
});

app.post("/api/packs/open", authMiddleware, async (req, res) => {
    try {
        const { state } = await getAlbumState(req.user.sub);
        const available = Math.max(0, Number(state.extraPacks || 0));

        if (available <= 0) {
            return res.status(400).json({ error: "Sem pacotes disponíveis" });
        }

        const collectedMap = state.collected || {};
        const missing = STICKERS.filter((s) => (collectedMap[s.id] || 0) < 1);
        const collected = STICKERS.filter((s) => (collectedMap[s.id] || 0) >= 1);

        const pack = [];
        const wasOwned = [];

        for (let i = 0; i < 5; i++) {
            const forceRepeat = collected.length > 0 && (missing.length === 0 || Math.random() < 0.3);
            const pool = forceRepeat ? collected : (missing.length > 0 ? missing : STICKERS);
            const sticker = pickRandomWeighted(pool);
            pack.push(sticker);
            wasOwned.push((collectedMap[sticker.id] || 0) >= 1);
            collectedMap[sticker.id] = (collectedMap[sticker.id] || 0) + 1;
        }

        let nextExtraPacks = state.extraPacks || 0;
        let source = "bonus";
        nextExtraPacks = Math.max(0, nextExtraPacks - 1);

        const newCount = wasOwned.filter((x) => !x).length;
        const repeatCount = 5 - newCount;
        const nowTimestamp = nowSqlTimestamp();

        await run(
            `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          updated_at = ?
      WHERE user_id = ?
      `,
            [
                JSON.stringify(collectedMap),
                state.packsUsedDate || "",
                state.packsUsedToday || 0,
                nextExtraPacks,
                nowTimestamp,
                req.user.sub,
            ]
        );

        await run(
            "INSERT INTO pack_history(user_id, opened_at, stickers_json, new_count, repeat_count, source) VALUES(?, ?, ?, ?, ?, ?)",
            [req.user.sub, nowTimestamp, JSON.stringify(pack), newCount, repeatCount, source]
        );

        return res.json({
            ok: true,
            pack,
            wasOwned,
            state: {
                collected: collectedMap,
                packsUsedDate: state.packsUsedDate || "",
                packsUsedToday: state.packsUsedToday || 0,
                extraPacks: nextExtraPacks,
                usedCodes: state.usedCodes,
            },
            summary: { newCount, repeatCount, source },
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao abrir pacote", detail: err.message });
    }
});

app.get("/api/packs/history", authMiddleware, async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 15)));
        const rows = await all(
            "SELECT id, opened_at, stickers_json, new_count, repeat_count, source FROM pack_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            [req.user.sub, limit]
        );

        const history = rows.map((r) => ({
            id: r.id,
            openedAt: r.opened_at,
            stickers: parseJSON(r.stickers_json || "[]", []),
            newCount: r.new_count,
            repeatCount: r.repeat_count,
            source: r.source,
        }));

        return res.json({ history });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar historico", detail: err.message });
    }
});

app.get("/api/stickers/:id", authMiddleware, async (req, res) => {
    const sticker = STICKER_BY_ID.get(req.params.id);
    if (!sticker) return res.status(404).json({ error: "Figurinha nao encontrada" });
    return res.json({ sticker });
});

// ─── Trade endpoints ────────────────────────────────────────────────────────

app.get("/api/trade/users", authMiddleware, async (req, res) => {
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

app.get("/api/trade/users/:userId/duplicates", authMiddleware, async (req, res) => {
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

app.get("/api/trade/users/:userId/wanted-from-me", authMiddleware, async (req, res) => {
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

app.post("/api/trade/offers", authMiddleware, requireTradeWindowOpen, async (req, res) => {
    try {
        const { toUserId, offeredStickerId, requestedStickerId } = req.body || {};

        if (!toUserId || !offeredStickerId || !requestedStickerId) {
            return res.status(400).json({ error: "Campos obrigatorios: toUserId, offeredStickerId, requestedStickerId" });
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

        // Verifica se tem cópias disponíveis considerando as pendências
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

        const toUserRow = await get("SELECT id, is_blocked FROM users WHERE id = ?", [Number(toUserId)]);
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

        // Emit notification event to the recipient
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

        return res.status(201).json({ ok: true, offerId: result.lastID });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao criar oferta", detail: err.message });
    }
});

app.get("/api/trade/offers", authMiddleware, async (req, res) => {
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

app.post("/api/trade/offers/:id/accept", authMiddleware, requireTradeWindowOpen, async (req, res) => {
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

        const fromState = await getValidCollectedMap(offer.from_user_id);
        const toState = await getValidCollectedMap(offer.to_user_id);

        const nowTimestamp = nowSqlTimestamp();
        if ((fromState[offer.offered_sticker_id] || 0) <= 1) {
            await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
            return res.status(409).json({ error: "O outro usuario nao tem mais essa figurinha repetida" });
        }
        if ((toState[offer.requested_sticker_id] || 0) <= 1) {
            await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
            return res.status(409).json({ error: "Voce nao tem mais essa figurinha repetida" });
        }

        const fromCollected = { ...fromState };
        fromCollected[offer.offered_sticker_id] = Number(fromCollected[offer.offered_sticker_id]) - 1;
        fromCollected[offer.requested_sticker_id] = (Number(fromCollected[offer.requested_sticker_id]) || 0) + 1;

        const toCollected = { ...toState };
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

        // Register in trade history for both users.
        // Convention: offered_sticker_id = what the user GAVE, requested_sticker_id = what they RECEIVED.
        // Creator (from_user): gave offered_sticker_id, received requested_sticker_id.
        // Acceptor (to_user): gave requested_sticker_id, received offered_sticker_id — columns are swapped.
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
            offerId: offerId,
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
                JSON.stringify({
                    ...sharedPayload,
                    recipientUserId: offer.from_user_id,
                    recipientUserName: creatorUser?.name,
                    coinsReceived,
                }),
                offer.to_user_id,
                offer.from_user_id,
                nowTimestamp,
            ]
        );
        await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
             VALUES('trade_accepted', ?, ?, ?, ?, ?)` ,
            [
                `Você aceitou a troca de ${creatorUser?.name || "Usuário"}: #${requestedSticker?.num} ${requestedSticker?.name || "figurinha"} por #${offeredSticker?.num} ${offeredSticker?.name || "figurinha"}. Você recebeu ${coinsReceived} moedas.`,
                JSON.stringify({
                    ...sharedPayload,
                    recipientUserId: offer.to_user_id,
                    recipientUserName: acceptorUser?.name,
                    coinsReceived,
                }),
                offer.to_user_id,
                offer.to_user_id,
                nowTimestamp,
            ]
        );

        const { state: newState } = await getAlbumState(req.user.sub);
        const validCollected = await getValidCollectedMap(req.user.sub);
        return res.json({ ok: true, state: { ...newState, collected: validCollected } });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao aceitar oferta", detail: err.message });
    }
});

app.post("/api/trade/coins/redeem", authMiddleware, async (req, res) => {
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

app.post("/api/trade/offers/:id/reject", authMiddleware, requireTradeWindowOpen, async (req, res) => {
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

        // Emit notification event
        if (offer.to_user_id === req.user.sub) {
            // Receiver rejected -> notify offerer
            const rejectorUser = await get("SELECT name FROM users WHERE id = ?", [req.user.sub]);
            const offeredSticker = STICKER_BY_ID.get(offer.offered_sticker_id);
            const eventMessage = `${rejectorUser?.name || "Usuário"} rejeitou sua troca!`;
            const eventPayload = {
                offerId: offerId,
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
            // Offerer cancelled -> notify receiver
            const cancellatorUser = await get("SELECT name FROM users WHERE id = ?", [req.user.sub]);
            const eventMessage = `${cancellatorUser?.name || "Usuário"} cancelou a troca pendente!`;
            const eventPayload = {
                offerId: offerId,
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

const TRADE_COINS_PER_TRADE = 3;

app.get("/api/trade/available", authMiddleware, async (req, res) => {
    try {
        const allAvailable = await buildTradeAvailableEntries(req.user.sub);
        const available = getCachedTradeAvailableSelection(req.user.sub, allAvailable);
        return res.json({
            available,
            totalAvailable: allAvailable.length,
            hasMore: allAvailable.length > available.length,
            limit: TRADE_AVAILABLE_LIMIT,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao buscar figurinhas disponíveis", detail: err.message });
    }
});

app.post("/api/trade/available/reroll", authMiddleware, async (req, res) => {
    try {
        const { state } = await getAlbumState(req.user.sub);
        const currentCoins = Number(state.tradeCoins || 0);
        if (currentCoins < TRADE_AVAILABLE_REROLL_COST) {
            return res.status(400).json({
                error: "Moedas insuficientes para ver novas figurinhas",
                tradeCoins: currentCoins,
                requiredCoins: TRADE_AVAILABLE_REROLL_COST,
            });
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
        const nextCoins = Math.max(0, currentCoins - TRADE_AVAILABLE_REROLL_COST);
        await run(
            "UPDATE album_states SET trade_coins = ?, updated_at = ? WHERE user_id = ?",
            [nextCoins, nowTimestamp, req.user.sub]
        );

        return res.status(201).json({
            ok: true,
            available,
            tradeCoins: nextCoins,
            spentCoins: TRADE_AVAILABLE_REROLL_COST,
            totalAvailable: allAvailable.length,
            hasMore: allAvailable.length > available.length,
            limit: TRADE_AVAILABLE_LIMIT,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao sortear novas figurinhas", detail: err.message });
    }
});

app.get("/api/trade/history", authMiddleware, async (req, res) => {
    try {
        const history = await all(
            "SELECT * FROM trade_history WHERE user_id = ? ORDER BY completed_at DESC",
            [req.user.sub]
        );

        const enriched = history.map((h) => ({
            id: h.id,
            completedAt: h.completed_at,
            partnerName: h.from_user_id === req.user.sub ?
                (h.to_user_id ? "..." : "Desconhecido") :
                (h.from_user_id ? "..." : "Desconhecido"),
            partnerUserId: h.from_user_id === req.user.sub ? h.to_user_id : h.from_user_id,
            offeredSticker: STICKER_BY_ID.get(h.offered_sticker_id) || { id: h.offered_sticker_id, name: "Desconhecida" },
            requestedSticker: STICKER_BY_ID.get(h.requested_sticker_id) || { id: h.requested_sticker_id, name: "Desconhecida" },
            iSent: h.from_user_id === req.user.sub,
        }));

        // Get partner names
        if (enriched.length > 0) {
            const partnerIds = [...new Set(enriched.map(h => h.partnerUserId).filter(Boolean))];
            if (partnerIds.length > 0) {
                const placeholders = partnerIds.map(() => "?").join(",");
                const partners = await all(`SELECT id, name FROM users WHERE id IN (${placeholders})`, partnerIds);
                const partnerMap = new Map(partners.map(p => [p.id, p.name]));
                enriched.forEach(h => {
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

// ─── End Trade endpoints ─────────────────────────────────────────────────────

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
