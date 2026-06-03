const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 3001);
const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_ROTATION_ENABLED = String(process.env.LOG_ROTATION_ENABLED || "true") === "true";
const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, "../../logs");
const LOG_ROTATION_INTERVAL = process.env.LOG_ROTATION_INTERVAL || "1d";
const LOG_ROTATION_MAX_FILES = Number(process.env.LOG_ROTATION_MAX_FILES || 14);
const AUDIT_LOG_CLEANUP_ENABLED = String(process.env.AUDIT_LOG_CLEANUP_ENABLED || "true") === "true";
const AUDIT_LOG_RETENTION_DAYS = Math.max(1, Number(process.env.AUDIT_LOG_RETENTION_DAYS || 10));
const AUDIT_LOG_CLEANUP_INTERVAL_HOURS = Math.max(1, Number(process.env.AUDIT_LOG_CLEANUP_INTERVAL_HOURS || 24));
const DAILY_LOGIN_BONUS_COINS = Math.max(0, Number(process.env.DAILY_LOGIN_BONUS_COINS || 3));
const DAILY_LOGIN_BONUS_PACKS = Math.max(0, Number(process.env.DAILY_LOGIN_BONUS_PACKS || 1));

const apiBaseUrlFromEnv = String(process.env.API_BASE_URL || "").trim();
const API_BASE_URL = apiBaseUrlFromEnv || `http://localhost:${PORT}/api`;

const FRONTEND_URL = String(process.env.FRONTEND_URL || "http://localhost:5173").trim();

if (NODE_ENV === "production" && !apiBaseUrlFromEnv) {
    throw new Error("API_BASE_URL é obrigatório em produção. Defina no backend/.env");
}
const DB_PATH = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(__dirname, "../../album.db");

const ROLE_ADMIN = "admin";
const ROLE_SERVIDOR = "servidor";
const ROLE_PLAYER = "jogador";
const ALLOWED_ROLES = new Set([ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER]);

module.exports = {
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
    AUDIT_LOG_CLEANUP_ENABLED,
    AUDIT_LOG_RETENTION_DAYS,
    AUDIT_LOG_CLEANUP_INTERVAL_HOURS,
    DAILY_LOGIN_BONUS_COINS,
    DAILY_LOGIN_BONUS_PACKS,
    API_BASE_URL,
    FRONTEND_URL,
    DB_PATH,
    ROLE_ADMIN,
    ROLE_SERVIDOR,
    ROLE_PLAYER,
    ALLOWED_ROLES,
};
