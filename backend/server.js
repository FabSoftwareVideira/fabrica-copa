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

const STICKERS = loadStickersFromFrontend();
const STICKER_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

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
        teamName: s.teamName,
        sectionName: s.sectionName,
        type: s.type,
        groupId: s.groupId,
    }));
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

function nowIso() {
    return new Date().toISOString();
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

function normalizeCode(raw) {
    return String(raw || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function signAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, {
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

    await run(
        `INSERT INTO refresh_tokens(user_id, token_hash, expires_at, revoked, created_at)
     VALUES(?, ?, ?, 0, CURRENT_TIMESTAMP)`,
        [userId, tokenHash, expiresAt]
    );

    return token;
}

async function revokeRefreshToken(rawToken) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Token ausente", code: "TOKEN_MISSING" });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        if (err && err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
        }
        return res.status(401).json({ error: "Token invalido", code: "TOKEN_INVALID" });
    }
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
}

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "album-backend", stickers: STICKERS.length });
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

        const passwordHash = await bcrypt.hash(cleanPassword, 10);
        const created = await run("INSERT INTO users(name, email, password_hash) VALUES(?, ?, ?)", [
            cleanName,
            cleanEmail,
            passwordHash,
        ]);

        await run("INSERT INTO album_states(user_id) VALUES(?)", [created.lastID]);

        const user = { id: created.lastID, name: cleanName, email: cleanEmail };
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

        const userRow = await get("SELECT id, name, email, password_hash FROM users WHERE email = ?", [cleanEmail]);
        if (!userRow) return res.status(401).json({ error: "Credenciais invalidas" });

        const ok = await bcrypt.compare(cleanPassword, userRow.password_hash);
        if (!ok) return res.status(401).json({ error: "Credenciais invalidas" });

        const user = { id: userRow.id, name: userRow.name, email: userRow.email };
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
            `SELECT rt.user_id, rt.expires_at, rt.revoked, u.name, u.email
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

        await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
        const user = { id: row.user_id, name: row.name, email: row.email };
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
        const row = await get("SELECT id, name, email FROM users WHERE id = ?", [req.user.sub]);
        if (!row) return res.status(404).json({ error: "Usuario nao encontrado" });
        return res.json({ user: row });
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

        await run(
            `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          used_codes_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
      `,
            [
                JSON.stringify(clientCollected),
                row.packs_used_date || "",
                row.packs_used_today || 0,
                row.extra_packs || 0,
                row.used_codes_json || "[]",
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

        const promo = PROMO_CODES[code];
        if (!promo) return res.status(400).json({ error: "Codigo invalido ou expirado" });

        const already = await get("SELECT id FROM redeemed_codes WHERE user_id = ? AND code = ?", [req.user.sub, code]);
        if (already) return res.status(409).json({ error: "Este codigo ja foi resgatado" });

        const { state } = await getAlbumState(req.user.sub);
        const usedCodes = Array.isArray(state.usedCodes) ? state.usedCodes : [];
        usedCodes.push(code);
        const extraPacks = (state.extraPacks || 0) + promo.packs;

        await run("INSERT INTO redeemed_codes(user_id, code, packs_added) VALUES(?, ?, ?)", [
            req.user.sub,
            code,
            promo.packs,
        ]);

        await run(
            `
      UPDATE album_states
      SET extra_packs = ?, used_codes_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
      `,
            [extraPacks, JSON.stringify(usedCodes), req.user.sub]
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

        await run(
            `
      UPDATE album_states
      SET collected_json = ?,
          packs_used_date = ?,
          packs_used_today = ?,
          extra_packs = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
      `,
            [
                JSON.stringify(collectedMap),
                nextPacksUsedDate,
                nextPacksUsedToday,
                nextExtraPacks,
                req.user.sub,
            ]
        );

        await run(
            "INSERT INTO pack_history(user_id, stickers_json, new_count, repeat_count, source) VALUES(?, ?, ?, ?, ?)",
            [req.user.sub, JSON.stringify(pack), newCount, repeatCount, source]
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

initDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend do album rodando em http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Falha ao inicializar banco:", err);
        process.exit(1);
    });
