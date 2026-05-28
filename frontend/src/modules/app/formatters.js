import { APP_TIMEZONE } from "./constants";

// Formatar datas para o formato "dd/mm/yyyy", sem horário.
function formatDate(value, timezone = APP_TIMEZONE) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR", { timeZone: timezone });
}

function formatDateTime(value, timeZone = APP_TIMEZONE) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", { timeZone });
}

function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function formatCountdownLongFormat(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}min`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    }

    if (minutes > 0) {
        return `${minutes}min ${seconds}s`;
    }

    return `${seconds}s`;
}

function normalizeNameKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, "")
        .replace(/\bjr\b/g, "junior")
        .replace(/\s+/g, " ")
        .trim();
}

function playerImageKey(name, teamId) {
    return `${normalizeNameKey(name)}::${String(teamId || "").toLowerCase()}`;
}

function normalizeTradeQuery(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

export {
    formatCountdown,
    formatCountdownLongFormat,
    formatDate,
    formatDateTime,
    normalizeNameKey,
    normalizeTradeQuery,
    playerImageKey,
    todayStr,
};
