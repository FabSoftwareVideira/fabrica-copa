function normalizeCode(raw) {
    return String(raw || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

module.exports = { normalizeCode };
