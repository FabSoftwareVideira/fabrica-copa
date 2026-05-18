function parseAllowedOrigins(raw) {
    if (!raw) return [];
    return String(raw)
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function createCorsOptions(rawOrigins) {
    const allowedOrigins = parseAllowedOrigins(rawOrigins);

    function isOriginAllowed(origin) {
        if (allowedOrigins.includes("*")) return true;
        return allowedOrigins.includes(origin);
    }

    return {
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (isOriginAllowed(origin)) return callback(null, true);
            return callback(new Error("Origin nao permitida por CORS"));
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    };
}

module.exports = {
    parseAllowedOrigins,
    createCorsOptions,
};
