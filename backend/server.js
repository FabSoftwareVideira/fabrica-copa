const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "album-2026-dev-secret";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const PACKS_PER_DAY = 1;
const APP_TIMEZONE = "America/Sao_Paulo";
const ROLE_ADMIN = "admin";
const ROLE_PROFESSOR = "professor";
const ROLE_PLAYER = "jogador";
const ALLOWED_ROLES = new Set([ROLE_ADMIN, ROLE_PROFESSOR, ROLE_PLAYER]);

const PROMO_CODES = {
    COPA2026: { packs: 3, label: "Bonus Copa 2026" },
    FIFA2026: { packs: 5, label: "Pacote FIFA" },
    BRASIL26: { packs: 2, label: "Vai Brasil" },
    WORLDCUP: { packs: 1, label: "World Cup" },
    MESSI10: { packs: 2, label: "El Clasico" },
    MBAPPE26: { packs: 3, label: "Les Bleus" },
    PANINI26: { packs: 500, label: "Panini Especial" },
    FIGURINHA: { packs: 2, label: "Figurinha Bonus" },
};

const dbPath = path.join(__dirname, "album.db");
const db = new sqlite3.Database(dbPath);

const BASE_STICKERS = loadStickersFromFrontend();
let CUSTOM_STICKERS = [];
let STICKERS = [...BASE_STICKERS];
let STICKER_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

function loadStickersFromFrontend() {
    const dataFile = path.join(__dirname, "..", "js", "data.js");
    const code = fs.readFileSync(dataFile, "utf8");
    const all = vm.runInNewContext(`${code}\nALL_STICKERS;`, {});
    if (!Array.isArray(all) || all.length === 0) {
        throw new Error("Catalogo de figurinhas nao encontrado no data.js");
    }
    return all.map((s) => ({
        id: s.id,
        num: s.num,
        name: s.name,
        icon: s.icon,
        teamId: s.teamId,
        teamName: s.teamName,
        teamImage: s.teamImage,
        sectionName: s.sectionName,
        type: s.type,
        groupId: s.groupId,
        image: s.image,
        section: s.section || (s.groupId ? `grupo-${s.groupId}` : "especial"),
    }));
}

function normalizeSticker(raw) {
    return {
        id: String(raw.id || ""),
        num: Number(raw.num || 0),
        name: String(raw.name || ""),
        icon: String(raw.icon || "🎟️"),
        teamId: raw.teamId || null,
        teamName: raw.teamName || null,
        teamImage: raw.teamImage || null,
        sectionName: String(raw.sectionName || "Especial"),
        type: String(raw.type || "custom"),
        groupId: raw.groupId || null,
        image: raw.image || "",
        section: raw.section || "especial",
        createdAt: raw.createdAt || null,
        createdByUserId: raw.createdByUserId || null,
    };
}

function rebuildStickerCatalog() {
    STICKERS = [...BASE_STICKERS, ...CUSTOM_STICKERS]
        .map(normalizeSticker)
        .sort((a, b) => Number(a.num) - Number(b.num));
    STICKER_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));
}

function findTeamMeta(teamId) {
    const id = String(teamId || "").trim().toLowerCase();
    if (!id) return null;
    const found = STICKERS.find(
        (s) => String(s.teamId || "").toLowerCase() === id && s.groupId && s.teamName
    );
    if (!found) return null;
    return {
        teamId: found.teamId,
        teamName: found.teamName,
        teamImage: found.teamImage || null,
        groupId: found.groupId,
        sectionName: found.sectionName || `Grupo ${found.groupId}`,
    };
}

async function loadCustomStickersFromDb() {
    const rows = await all(
        `SELECT id, num, name, icon, team_id, team_name, team_image, section_name, type, group_id, image, created_by_user_id, created_at
         FROM custom_stickers
         ORDER BY num ASC`
    );

    CUSTOM_STICKERS = rows.map((r) => ({
        id: r.id,
        num: Number(r.num),
        name: r.name,
        icon: r.icon,
        teamId: r.team_id,
        teamName: r.team_name,
        teamImage: r.team_image,
        sectionName: r.section_name,
        type: r.type,
        groupId: r.group_id,
        image: r.image,
        section: r.group_id ? `grupo-${r.group_id}` : "especial",
        createdAt: r.created_at,
        createdByUserId: r.created_by_user_id,
    }));

    rebuildStickerCatalog();
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function parseJSON(value, fallback) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function todayStr() {
    return formatDateParts(new Date(), APP_TIMEZONE).date;
}

function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

function formatDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        date: `${map.year}-${map.month}-${map.day}`,
        dateTime: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`,
    };
}

function nowSqlTimestamp() {
    return formatDateParts(new Date(), APP_TIMEZONE).dateTime;
}

function normalizeCode(raw) {
    return String(raw || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function signAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
}

function makeRefreshToken() {
    return crypto.randomBytes(48).toString("hex");
}

function parseAllowedOrigins(raw) {
    if (!raw) return [];
    return String(raw)
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(CORS_ORIGIN);

function isOriginAllowed(origin) {
    if (allowedOrigins.includes("*")) return true;
    return allowedOrigins.includes(origin);
}

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error("Origin nao permitida por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

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

async function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Token ausente", code: "TOKEN_MISSING" });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const dbUser = await get(
            "SELECT id, name, email, role, is_blocked FROM users WHERE id = ?",
            [payload.sub]
        );
        if (!dbUser) return res.status(401).json({ error: "Usuario nao encontrado", code: "USER_NOT_FOUND" });
        if (Number(dbUser.is_blocked || 0) === 1) {
            return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador.", code: "USER_BLOCKED" });
        }

        req.user = {
            sub: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role || ROLE_PLAYER,
        };
        req.dbUser = dbUser;
        return next();
    } catch (err) {
        if (err && err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
        }
        return res.status(401).json({ error: "Token invalido", code: "TOKEN_INVALID" });
    }
}

function requireRoles(...roles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !roles.includes(role)) {
            return res.status(403).json({ error: "Sem permissao para esta acao" });
        }
        return next();
    };
}

async function ensureColumn(table, column, sqlDefinition) {
    const cols = await all(`PRAGMA table_info(${table})`);
    const exists = cols.some((c) => c.name === column);
    if (!exists) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDefinition}`);
    }
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
            usedCodes: parseJSON(row.used_codes_json || "[]", []),
        },
    };
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

async function initDb() {
    await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'jogador',
            is_blocked INTEGER NOT NULL DEFAULT 0,
            blocked_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'jogador'");
    await ensureColumn("users", "is_blocked", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("users", "blocked_reason", "TEXT NOT NULL DEFAULT ''");

    await run(`
    CREATE TABLE IF NOT EXISTS album_states (
      user_id INTEGER PRIMARY KEY,
      collected_json TEXT NOT NULL DEFAULT '{}',
      packs_used_date TEXT NOT NULL DEFAULT '',
      packs_used_today INTEGER NOT NULL DEFAULT 0,
      extra_packs INTEGER NOT NULL DEFAULT 0,
      used_codes_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS redeemed_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      packs_added INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
        CREATE TABLE IF NOT EXISTS user_coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            target_user_id INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            packs_added INTEGER NOT NULL DEFAULT 1,
            is_generic INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            redeemed_at TEXT,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await ensureColumn("user_coupons", "is_generic", "INTEGER NOT NULL DEFAULT 0");

    await run(`
        CREATE TABLE IF NOT EXISTS custom_stickers (
            id TEXT PRIMARY KEY,
            num INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT '🎟️',
            team_id TEXT,
            team_name TEXT,
            team_image TEXT,
            section_name TEXT NOT NULL DEFAULT 'Especial',
            type TEXT NOT NULL DEFAULT 'custom',
            group_id TEXT,
            image TEXT,
            created_by_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS system_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            payload_json TEXT,
            created_by_user_id INTEGER,
            target_user_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await ensureColumn("system_events", "target_user_id", "INTEGER");

    await run(`
    CREATE TABLE IF NOT EXISTS pack_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      stickers_json TEXT NOT NULL,
      new_count INTEGER NOT NULL,
      repeat_count INTEGER NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      offered_sticker_id TEXT NOT NULL,
      requested_sticker_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await run(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      offered_sticker_id TEXT NOT NULL,
      requested_sticker_id TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "album-backend", stickers: STICKERS.length });
});

app.get("/api/stickers/catalog", async (_req, res) => {
    return res.json({ stickers: STICKERS, total: STICKERS.length });
});

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        const cleanName = String(name || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();
        const cleanPassword = String(password || "");

        if (cleanName.length < 2) return res.status(400).json({ error: "Nome invalido" });
        if (!cleanEmail.includes("@")) return res.status(400).json({ error: "Email invalido" });
        if (cleanPassword.length < 6) return res.status(400).json({ error: "Senha deve ter 6+ caracteres" });

        const existing = await get("SELECT id FROM users WHERE email = ?", [cleanEmail]);
        if (existing) return res.status(409).json({ error: "Email ja cadastrado" });

        const usersCountRow = await get("SELECT COUNT(*) AS total FROM users");
        const role = Number(usersCountRow?.total || 0) === 0 ? ROLE_ADMIN : ROLE_PLAYER;

        const passwordHash = await bcrypt.hash(cleanPassword, 10);
        const created = await run("INSERT INTO users(name, email, password_hash, role) VALUES(?, ?, ?, ?)", [
            cleanName,
            cleanEmail,
            passwordHash,
            role,
        ]);

        await run("INSERT INTO album_states(user_id) VALUES(?)", [created.lastID]);

        const user = { id: created.lastID, name: cleanName, email: cleanEmail, role };
        const accessToken = signAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);

        return res.status(201).json({
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: ACCESS_TOKEN_TTL,
            user,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao criar usuario", detail: err.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const cleanEmail = String(email || "").trim().toLowerCase();
        const cleanPassword = String(password || "");

        const userRow = await get("SELECT id, name, email, password_hash, role, is_blocked FROM users WHERE email = ?", [cleanEmail]);
        if (!userRow) return res.status(401).json({ error: "Credenciais invalidas" });
        if (Number(userRow.is_blocked || 0) === 1) {
            return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador." });
        }

        const ok = await bcrypt.compare(cleanPassword, userRow.password_hash);
        if (!ok) return res.status(401).json({ error: "Credenciais invalidas" });

        const user = { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role || ROLE_PLAYER };
        const accessToken = signAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);

        return res.json({
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: ACCESS_TOKEN_TTL,
            user,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro no login", detail: err.message });
    }
});

app.post("/api/auth/refresh", async (req, res) => {
    try {
        const refreshToken = String(req.body?.refreshToken || "");
        if (!refreshToken) return res.status(400).json({ error: "refreshToken obrigatorio" });

        const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        const row = await get(
            `SELECT rt.user_id, rt.expires_at, rt.revoked, u.name, u.email, u.role, u.is_blocked
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?`,
            [tokenHash]
        );

        if (!row || row.revoked) {
            return res.status(401).json({ error: "Refresh token invalido", code: "REFRESH_INVALID" });
        }
        if (new Date(row.expires_at).getTime() <= Date.now()) {
            await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
            return res.status(401).json({ error: "Refresh token expirado", code: "REFRESH_EXPIRED" });
        }
        if (Number(row.is_blocked || 0) === 1) {
            await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
            return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador.", code: "USER_BLOCKED" });
        }

        await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
        const user = { id: row.user_id, name: row.name, email: row.email, role: row.role || ROLE_PLAYER };
        const accessToken = signAccessToken(user);
        const newRefreshToken = await createRefreshToken(user.id);

        return res.json({
            accessToken,
            refreshToken: newRefreshToken,
            tokenType: "Bearer",
            expiresIn: ACCESS_TOKEN_TTL,
            user,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro no refresh", detail: err.message });
    }
});

app.post("/api/auth/logout", async (req, res) => {
    try {
        const refreshToken = String(req.body?.refreshToken || "");
        if (refreshToken) {
            await revokeRefreshToken(refreshToken);
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: "Erro no logout", detail: err.message });
    }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
        const row = await get("SELECT id, name, email, role, is_blocked FROM users WHERE id = ?", [req.user.sub]);
        if (!row) return res.status(404).json({ error: "Usuario nao encontrado" });
        return res.json({ user: sanitizeUser(row) });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao buscar usuario", detail: err.message });
    }
});

app.get("/api/album/state", authMiddleware, async (req, res) => {
    try {
        const { state } = await getAlbumState(req.user.sub);
        return res.json(state);
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar estado", detail: err.message });
    }
});

app.put("/api/album/state", authMiddleware, async (req, res) => {
    try {
        const { row } = await getAlbumState(req.user.sub);
        const clientCollected = req.body?.collected || {};
        const updatedAt = nowSqlTimestamp();

        await run(
            `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          used_codes_json = ?,
          updated_at = ?
      WHERE user_id = ?
      `,
            [
                JSON.stringify(clientCollected),
                row.packs_used_date || "",
                row.packs_used_today || 0,
                row.extra_packs || 0,
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

app.post("/api/promo/redeem", authMiddleware, async (req, res) => {
    try {
        const code = normalizeCode(req.body?.code);
        if (!code) return res.status(400).json({ error: "Codigo obrigatorio" });

        let promo = PROMO_CODES[code];
        let isGeneratedCoupon = false;
        let couponRow = null;

        if (!promo) {
            couponRow = await get(
                `SELECT id, packs_added, is_generic
                 FROM user_coupons
                 WHERE code = ? AND status = 'active'
                   AND (target_user_id = ? OR is_generic = 1)`,
                [code, req.user.sub]
            );
            if (couponRow) {
                promo = { packs: Number(couponRow.packs_added || 1), label: "Cupom de professor/admin" };
                isGeneratedCoupon = true;
            }
        }

        if (!promo) return res.status(400).json({ error: "Codigo invalido ou expirado" });

        const isGenericGeneratedCoupon =
            isGeneratedCoupon && Number(couponRow?.is_generic || 0) === 1;

        if (!isGeneratedCoupon || isGenericGeneratedCoupon) {
            const already = await get("SELECT id FROM redeemed_codes WHERE user_id = ? AND code = ?", [req.user.sub, code]);
            if (already) return res.status(409).json({ error: "Este codigo ja foi resgatado" });
        }

        const { state } = await getAlbumState(req.user.sub);
        const usedCodes = Array.isArray(state.usedCodes) ? state.usedCodes : [];
        usedCodes.push(code);
        const extraPacks = (state.extraPacks || 0) + promo.packs;

        if (isGeneratedCoupon && couponRow && !isGenericGeneratedCoupon) {
            await run(
                "UPDATE user_coupons SET status = 'redeemed', redeemed_at = ? WHERE id = ?",
                [nowSqlTimestamp(), couponRow.id]
            );
        } else {
            await run("INSERT INTO redeemed_codes(user_id, code, packs_added) VALUES(?, ?, ?)", [
                req.user.sub,
                code,
                promo.packs,
            ]);
        }

        await run(
            `
      UPDATE album_states
        SET extra_packs = ?, used_codes_json = ?, updated_at = ?
      WHERE user_id = ?
      `,
            [extraPacks, JSON.stringify(usedCodes), nowSqlTimestamp(), req.user.sub]
        );

        return res.json({
            ok: true,
            code,
            packs: promo.packs,
            label: promo.label,
            extraPacks,
            usedCodes,
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao resgatar codigo", detail: err.message });
    }
});

app.get("/api/coupons/targets", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_PROFESSOR), async (req, res) => {
    try {
        const users = await all(
            `SELECT id, name, email, role, is_blocked
             FROM users
             WHERE id != ?
             ORDER BY name ASC`,
            [req.user.sub]
        );
        return res.json({ users: users.map(sanitizeUser) });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar usuarios", detail: err.message });
    }
});

app.post("/api/coupons/generate", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_PROFESSOR), async (req, res) => {
    try {
        const targetUserId = Number(req.body?.targetUserId || 0);
        const hasTargetUser = targetUserId > 0;
        if (hasTargetUser && targetUserId === req.user.sub) {
            return res.status(400).json({ error: "Nao pode gerar cupom para si mesmo" });
        }

        let targetUser = null;
        if (hasTargetUser) {
            targetUser = await get("SELECT id, name, is_blocked FROM users WHERE id = ?", [targetUserId]);
            if (!targetUser) return res.status(404).json({ error: "Usuario alvo nao encontrado" });
            if (Number(targetUser.is_blocked || 0) === 1) {
                return res.status(400).json({ error: "Nao e possivel gerar cupom para usuario bloqueado" });
            }
        }

        const requestedPacks = Number(req.body?.packs || 1);
        const packs = req.user.role === ROLE_ADMIN
            ? Math.max(1, Math.min(20, Number.isFinite(requestedPacks) ? requestedPacks : 1))
            : 1;
        const isGeneric = hasTargetUser ? 0 : 1;
        const couponTargetUserId = hasTargetUser ? targetUserId : req.user.sub;

        const code = `BONUS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

        const couponCreatedAt = nowSqlTimestamp();
        await run(
            `INSERT INTO user_coupons(code, target_user_id, created_by_user_id, packs_added, is_generic, status, created_at)
             VALUES(?, ?, ?, ?, ?, 'active', ?)`,
            [code, couponTargetUserId, req.user.sub, packs, isGeneric, couponCreatedAt]
        );

        if (hasTargetUser) {
            const eventMessage = `Você recebeu um cupom de ${packs} pacote(s) de ${req.user.name}.`;
            const eventPayload = { code, packs, createdByName: req.user.name, createdByRole: req.user.role };
            await run(
                `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
                 VALUES('coupon_created', ?, ?, ?, ?, ?)`,
                [eventMessage, JSON.stringify(eventPayload), req.user.sub, targetUserId, couponCreatedAt]
            );
        }

        return res.status(201).json({
            ok: true,
            coupon: {
                code,
                targetUserId: hasTargetUser ? targetUserId : null,
                targetUserName: hasTargetUser ? targetUser?.name : "qualquer usuário",
                isGeneric: isGeneric === 1,
                packs,
                createdByRole: req.user.role,
            },
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao gerar cupom", detail: err.message });
    }
});

app.get("/api/admin/users", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
    try {
        const users = await all(
            `SELECT id, name, email, role, is_blocked, blocked_reason, created_at
             FROM users
             ORDER BY id ASC`
        );
        return res.json({
            users: users.map((u) => ({
                ...sanitizeUser(u),
                blockedReason: u.blocked_reason || "",
                createdAt: u.created_at,
            })),
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao listar usuarios", detail: err.message });
    }
});

app.put("/api/admin/users/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
    try {
        const userId = Number(req.params.id || 0);
        if (!userId) return res.status(400).json({ error: "id invalido" });

        const target = await get("SELECT id, role, is_blocked FROM users WHERE id = ?", [userId]);
        if (!target) return res.status(404).json({ error: "Usuario nao encontrado" });

        if (userId === req.user.sub && req.body?.role && req.body.role !== ROLE_ADMIN) {
            return res.status(400).json({ error: "Admin nao pode remover seu proprio papel admin" });
        }
        if (userId === req.user.sub && Number(req.body?.isBlocked) === 1) {
            return res.status(400).json({ error: "Admin nao pode bloquear a si mesmo" });
        }

        const nextRole = req.body?.role ? String(req.body.role) : target.role;
        if (!ALLOWED_ROLES.has(nextRole)) {
            return res.status(400).json({ error: "Perfil invalido" });
        }

        const nextBlocked = req.body?.isBlocked === undefined
            ? Number(target.is_blocked || 0)
            : Number(req.body.isBlocked ? 1 : 0);

        const blockedReason = nextBlocked ? String(req.body?.blockedReason || "Bloqueado pelo administrador").trim() : "";

        await run(
            "UPDATE users SET role = ?, is_blocked = ?, blocked_reason = ? WHERE id = ?",
            [nextRole, nextBlocked, blockedReason, userId]
        );

        const updated = await get(
            "SELECT id, name, email, role, is_blocked, blocked_reason, created_at FROM users WHERE id = ?",
            [userId]
        );

        return res.json({
            ok: true,
            user: {
                ...sanitizeUser(updated),
                blockedReason: updated.blocked_reason || "",
                createdAt: updated.created_at,
            },
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao atualizar usuario", detail: err.message });
    }
});

app.put("/api/admin/users/:id/password", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
    try {
        const userId = Number(req.params.id || 0);
        const password = String(req.body?.password || "");
        if (!userId) return res.status(400).json({ error: "id invalido" });
        if (password.length < 6) return res.status(400).json({ error: "Senha deve ter 6+ caracteres" });

        const target = await get("SELECT id FROM users WHERE id = ?", [userId]);
        if (!target) return res.status(404).json({ error: "Usuario nao encontrado" });

        const passwordHash = await bcrypt.hash(password, 10);
        await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao alterar senha", detail: err.message });
    }
});

app.post("/api/admin/stickers", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const icon = String(req.body?.icon || "🎟️").trim() || "🎟️";
        const type = String(req.body?.type || "custom").trim() || "custom";
        const image = String(req.body?.image || "").trim();
        const teamIdRaw = String(req.body?.teamId || "").trim();

        if (name.length < 2) {
            return res.status(400).json({ error: "Nome da figurinha invalido" });
        }

        const teamMeta = teamIdRaw ? findTeamMeta(teamIdRaw) : null;
        if (teamIdRaw && !teamMeta) {
            return res.status(400).json({ error: "Time invalido para esta figurinha" });
        }

        const maxNumRow = await get("SELECT MAX(num) AS maxNum FROM custom_stickers");
        const baseMaxNum = STICKERS.reduce((acc, s) => Math.max(acc, Number(s.num || 0)), 0);
        const nextNum = Math.max(Number(maxNumRow?.maxNum || 0), baseMaxNum) + 1;
        const stickerId = `custom-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
        const createdAt = nowSqlTimestamp();

        const sectionName = teamMeta ? teamMeta.sectionName : "Especial";
        const groupId = teamMeta ? teamMeta.groupId : null;
        const teamId = teamMeta ? teamMeta.teamId : null;
        const teamName = teamMeta ? teamMeta.teamName : null;
        const teamImage = teamMeta ? teamMeta.teamImage : null;

        await run(
            `INSERT INTO custom_stickers(
                id, num, name, icon, team_id, team_name, team_image, section_name, type, group_id, image, created_by_user_id, created_at
             )
             VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                stickerId,
                nextNum,
                name,
                icon,
                teamId,
                teamName,
                teamImage,
                sectionName,
                type,
                groupId,
                image,
                req.user.sub,
                createdAt,
            ]
        );

        const sticker = normalizeSticker({
            id: stickerId,
            num: nextNum,
            name,
            icon,
            teamId,
            teamName,
            teamImage,
            sectionName,
            type,
            groupId,
            image,
            section: groupId ? `grupo-${groupId}` : "especial",
            createdAt,
            createdByUserId: req.user.sub,
        });

        CUSTOM_STICKERS.push(sticker);
        rebuildStickerCatalog();

        const eventPayload = {
            stickerId: sticker.id,
            stickerName: sticker.name,
            num: sticker.num,
            icon: sticker.icon,
            image: sticker.image,
            type: sticker.type,
            teamId: sticker.teamId,
            teamName: sticker.teamName,
            groupId: sticker.groupId,
            sectionName: sticker.sectionName,
            teamImage: sticker.teamImage,
            createdByName: req.user.name,
        };
        const message = `${req.user.name} criou a figurinha #${sticker.num} (${sticker.name})`;

        const eventInsert = await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, created_at)
             VALUES('sticker_created', ?, ?, ?, ?)`,
            [message, JSON.stringify(eventPayload), req.user.sub, createdAt]
        );

        return res.status(201).json({
            ok: true,
            sticker,
            event: {
                id: eventInsert.lastID,
                type: "sticker_created",
                message,
                payload: eventPayload,
                createdAt,
                createdByUserId: req.user.sub,
            },
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao criar figurinha", detail: err.message });
    }
});

app.get("/api/admin/stickers/recent", authMiddleware, requireRoles(ROLE_ADMIN, ROLE_PROFESSOR), async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
        const rows = await all(
            `SELECT cs.id, cs.num, cs.name, cs.icon, cs.team_id, cs.team_name, cs.team_image, cs.section_name, cs.type, cs.group_id, cs.image, cs.created_at, cs.created_by_user_id,
                    u.name AS created_by_user_name
             FROM custom_stickers cs
             LEFT JOIN users u ON u.id = cs.created_by_user_id
             ORDER BY cs.created_at DESC
             LIMIT ?`,
            [limit]
        );

        const stickers = rows.map((r) => ({
            id: r.id,
            num: Number(r.num),
            name: r.name,
            icon: r.icon,
            teamId: r.team_id,
            teamName: r.team_name,
            teamImage: r.team_image,
            sectionName: r.section_name,
            type: r.type,
            groupId: r.group_id,
            image: r.image,
            section: r.group_id ? `grupo-${r.group_id}` : "especial",
            createdAt: r.created_at,
            createdByUserId: r.created_by_user_id,
            createdByUserName: r.created_by_user_name || "Admin",
        }));

        return res.json({ stickers });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao carregar figurinhas criadas", detail: err.message });
    }
});

app.delete("/api/admin/stickers/:id", authMiddleware, requireRoles(ROLE_ADMIN), async (req, res) => {
    try {
        const stickerId = String(req.params.id || "").trim();
        if (!stickerId) return res.status(400).json({ error: "ID invalido" });

        const existing = await get("SELECT id, num, name FROM custom_stickers WHERE id = ?", [stickerId]);
        if (!existing) return res.status(404).json({ error: "Figurinha nao encontrada" });

        await run("DELETE FROM custom_stickers WHERE id = ?", [stickerId]);

        // remove from in-memory catalog
        CUSTOM_STICKERS = CUSTOM_STICKERS.filter((s) => s.id !== stickerId);
        rebuildStickerCatalog();

        const message = `${req.user.name} removeu a figurinha #${existing.num} (${existing.name})`;
        const deletedAt = nowSqlTimestamp();
        const eventInsert = await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, created_at)
             VALUES('sticker_deleted', ?, ?, ?, ?)`,
            [message, JSON.stringify({ stickerId, num: existing.num, stickerName: existing.name, createdByName: req.user.name }), req.user.sub, deletedAt]
        );

        return res.json({
            ok: true,
            stickerId,
            event: { id: eventInsert.lastID, type: "sticker_deleted", message, createdAt: deletedAt },
        });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao excluir figurinha", detail: err.message });
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
        const today = todayStr();
        const usedToday = state.packsUsedDate === today ? state.packsUsedToday : 0;
        const available = Math.max(0, PACKS_PER_DAY - usedToday) + (state.extraPacks || 0);

        if (available <= 0) {
            return res.status(400).json({ error: "Limite diario atingido" });
        }

        const collectedMap = state.collected || {};
        const missing = STICKERS.filter((s) => (collectedMap[s.id] || 0) < 1);
        const collected = STICKERS.filter((s) => (collectedMap[s.id] || 0) >= 1);

        const pack = [];
        const wasOwned = [];

        for (let i = 0; i < 5; i++) {
            const forceRepeat = collected.length > 0 && (missing.length === 0 || Math.random() < 0.3);
            const pool = forceRepeat ? collected : (missing.length > 0 ? missing : STICKERS);
            const sticker = pickRandom(pool);
            pack.push(sticker);
            wasOwned.push((collectedMap[sticker.id] || 0) >= 1);
            collectedMap[sticker.id] = (collectedMap[sticker.id] || 0) + 1;
        }

        let nextPacksUsedDate = state.packsUsedDate;
        let nextPacksUsedToday = usedToday;
        let nextExtraPacks = state.extraPacks || 0;
        let source = "daily";

        if (state.packsUsedDate !== today) {
            nextPacksUsedDate = today;
            nextPacksUsedToday = 0;
        }

        if (nextPacksUsedToday < PACKS_PER_DAY) {
            nextPacksUsedToday += 1;
            source = "daily";
        } else {
            nextExtraPacks = Math.max(0, nextExtraPacks - 1);
            source = "bonus";
        }

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
                nextPacksUsedDate,
                nextPacksUsedToday,
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
                packsUsedDate: nextPacksUsedDate,
                packsUsedToday: nextPacksUsedToday,
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
            const { state } = await getAlbumState(user.id);
            const duplicateCount = Object.values(state.collected).reduce(
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

        const user = await get("SELECT id, name FROM users WHERE id = ?", [userId]);
        if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

        const { state } = await getAlbumState(userId);
        const duplicates = STICKERS
            .filter((s) => (state.collected[s.id] || 0) > 1)
            .map((s) => ({ ...s, count: Number(state.collected[s.id]) }));

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

        const user = await get("SELECT id, name FROM users WHERE id = ?", [userId]);
        if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

        const { state: myState } = await getAlbumState(req.user.sub);
        const { state: targetState } = await getAlbumState(userId);

        const wantedFromMe = STICKERS
            .filter((s) => (myState.collected[s.id] || 0) > 1 && (targetState.collected[s.id] || 0) < 1)
            .map((s) => ({ ...s, count: Number(myState.collected[s.id]) }))
            .sort((a, b) => a.num - b.num);

        return res.json({ user: { id: user.id, name: user.name }, stickers: wantedFromMe });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao buscar figurinhas desejadas", detail: err.message });
    }
});

app.post("/api/trade/offers", authMiddleware, async (req, res) => {
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

        const { state: fromState } = await getAlbumState(req.user.sub);
        if ((fromState.collected[offeredStickerId] || 0) <= 1) {
            return res.status(400).json({ error: "Voce precisa ter ao menos uma figurinha repetida para oferecer" });
        }

        const toUserRow = await get("SELECT id FROM users WHERE id = ?", [Number(toUserId)]);
        if (!toUserRow) return res.status(404).json({ error: "Usuario destino nao encontrado" });

        const { state: toState } = await getAlbumState(Number(toUserId));
        if ((toState.collected[requestedStickerId] || 0) <= 1) {
            return res.status(400).json({ error: "O outro usuario nao tem essa figurinha repetida" });
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
             WHERE o.to_user_id = ? AND o.status = 'pending'
             ORDER BY o.created_at DESC`,
            [req.user.sub]
        );

        const outgoingRows = await all(
            `SELECT o.id, o.to_user_id, o.offered_sticker_id, o.requested_sticker_id, o.status, o.created_at,
                    u.name AS to_user_name
             FROM trade_offers o
             JOIN users u ON u.id = o.to_user_id
             WHERE o.from_user_id = ? AND o.status = 'pending'
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

app.post("/api/trade/offers/:id/accept", authMiddleware, async (req, res) => {
    try {
        const offerId = Number(req.params.id);
        const offer = await get(
            "SELECT * FROM trade_offers WHERE id = ? AND to_user_id = ? AND status = 'pending'",
            [offerId, req.user.sub]
        );
        if (!offer) return res.status(404).json({ error: "Oferta nao encontrada" });

        const { state: fromState } = await getAlbumState(offer.from_user_id);
        const { state: toState } = await getAlbumState(offer.to_user_id);

        const nowTimestamp = nowSqlTimestamp();
        if ((fromState.collected[offer.offered_sticker_id] || 0) <= 1) {
            await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
            return res.status(409).json({ error: "O outro usuario nao tem mais essa figurinha repetida" });
        }
        if ((toState.collected[offer.requested_sticker_id] || 0) <= 1) {
            await run("UPDATE trade_offers SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowTimestamp, offerId]);
            return res.status(409).json({ error: "Voce nao tem mais essa figurinha repetida" });
        }

        const fromCollected = { ...fromState.collected };
        fromCollected[offer.offered_sticker_id] = Number(fromCollected[offer.offered_sticker_id]) - 1;
        fromCollected[offer.requested_sticker_id] = (Number(fromCollected[offer.requested_sticker_id]) || 0) + 1;

        const toCollected = { ...toState.collected };
        toCollected[offer.requested_sticker_id] = Number(toCollected[offer.requested_sticker_id]) - 1;
        toCollected[offer.offered_sticker_id] = (Number(toCollected[offer.offered_sticker_id]) || 0) + 1;

        await run(
            "UPDATE album_states SET collected_json = ?, updated_at = ? WHERE user_id = ?",
            [JSON.stringify(fromCollected), nowTimestamp, offer.from_user_id]
        );
        await run(
            "UPDATE album_states SET collected_json = ?, updated_at = ? WHERE user_id = ?",
            [JSON.stringify(toCollected), nowTimestamp, offer.to_user_id]
        );
        await run(
            "UPDATE trade_offers SET status = 'accepted', updated_at = ? WHERE id = ?",
            [nowTimestamp, offerId]
        );

        // Register in trade history for both users
        await run(
            "INSERT INTO trade_history(user_id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id, completed_at) VALUES(?, ?, ?, ?, ?, ?)",
            [offer.from_user_id, offer.from_user_id, offer.to_user_id, offer.offered_sticker_id, offer.requested_sticker_id, nowTimestamp]
        );
        await run(
            "INSERT INTO trade_history(user_id, from_user_id, to_user_id, offered_sticker_id, requested_sticker_id, completed_at) VALUES(?, ?, ?, ?, ?, ?)",
            [offer.to_user_id, offer.from_user_id, offer.to_user_id, offer.offered_sticker_id, offer.requested_sticker_id, nowTimestamp]
        );

        // Emit notification to the offer creator
        const offeredSticker = STICKER_BY_ID.get(offer.offered_sticker_id);
        const requestedSticker = STICKER_BY_ID.get(offer.requested_sticker_id);
        const creatorUser = await get("SELECT name FROM users WHERE id = ?", [offer.from_user_id]);
        const acceptorUser = await get("SELECT name FROM users WHERE id = ?", [offer.to_user_id]);
        const eventMessage = `${acceptorUser?.name || "Usuário"} aceitou sua troca: #${offeredSticker?.num} ${offeredSticker?.name || "figurinha"} por #${requestedSticker?.num} ${requestedSticker?.name || "figurinha"}`;
        const eventPayload = {
            offerId: offerId,
            fromUserId: offer.from_user_id,
            toUserId: offer.to_user_id,
            toUserName: acceptorUser?.name,
            offeredStickerId: offer.offered_sticker_id,
            offeredStickerNum: offeredSticker?.num,
            offeredStickerName: offeredSticker?.name,
            requestedStickerId: offer.requested_sticker_id,
            requestedStickerNum: requestedSticker?.num,
            requestedStickerName: requestedSticker?.name,
        };
        await run(
            `INSERT INTO system_events(event_type, message, payload_json, created_by_user_id, target_user_id, created_at)
             VALUES('trade_accepted', ?, ?, ?, ?, ?)`,
            [eventMessage, JSON.stringify(eventPayload), offer.to_user_id, offer.from_user_id, nowTimestamp]
        );

        const { state: newState } = await getAlbumState(req.user.sub);
        return res.json({ ok: true, state: newState });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao aceitar oferta", detail: err.message });
    }
});

app.post("/api/trade/offers/:id/reject", authMiddleware, async (req, res) => {
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

app.get("/api/trade/available", authMiddleware, async (req, res) => {
    try {
        const { state: myState } = await getAlbumState(req.user.sub);
        const myCollected = myState.collected || {};

        const users = await all("SELECT id, name FROM users WHERE id != ?", [req.user.sub]);

        const stickerOffers = new Map();

        for (const user of users) {
            const { state: userState } = await getAlbumState(user.id);
            const userCollected = userState.collected || {};

            for (const sticker of STICKERS) {
                const userCount = Number(userCollected[sticker.id] || 0);
                const myCount = Number(myCollected[sticker.id] || 0);

                if (userCount > 1 && myCount < 1) {
                    if (!stickerOffers.has(sticker.id)) {
                        stickerOffers.set(sticker.id, { sticker, offeredBy: [] });
                    }
                    stickerOffers.get(sticker.id).offeredBy.push({
                        userId: user.id,
                        userName: user.name,
                        count: userCount,
                    });
                }
            }
        }

        const available = [...stickerOffers.values()].sort((a, b) => a.sticker.num - b.sticker.num);
        return res.json({ available });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao buscar figurinhas disponíveis", detail: err.message });
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

initDb()
    .then(async () => {
        await loadCustomStickersFromDb();
        app.listen(PORT, () => {
            console.log(`Backend do album rodando em http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Falha ao inicializar banco:", err);
        process.exit(1);
    });
