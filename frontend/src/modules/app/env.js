const BASE_URL = import.meta.env.BASE_URL || "/";
const BASE_URL_PREFIX = BASE_URL.endsWith("/")
    ? BASE_URL.slice(0, -1)
    : BASE_URL;

function withBasePath(assetPath) {
    const value = String(assetPath || "").trim();
    if (!value) return "";
    if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:")) {
        return value;
    }
    if (!value.startsWith("/")) return value;
    if (!BASE_URL_PREFIX) return value;
    return `${BASE_URL_PREFIX}${value}`;
}

const FRONTEND_ENV = import.meta.env.MODE || "development";
const IS_DEV = Boolean(import.meta.env.DEV);
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (IS_DEV
        ? `http://${window.location.hostname || "localhost"}:3001/api`
        : `${window.location.origin}${BASE_URL_PREFIX}/api`);

const API_BASE_ORIGIN = (() => {
    try {
        return new URL(API_BASE_URL, window.location.origin).origin;
    } catch {
        return window.location.origin;
    }
})();

const GOOGLE_CLIENT_ID = String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
).trim();

const FRONTEND_LOG_ENDPOINT = `${API_BASE_URL}/logs/frontend-error`;

export {
    API_BASE_ORIGIN,
    API_BASE_URL,
    BASE_URL,
    BASE_URL_PREFIX,
    FRONTEND_ENV,
    FRONTEND_LOG_ENDPOINT,
    GOOGLE_CLIENT_ID,
    IS_DEV,
    withBasePath,
};
