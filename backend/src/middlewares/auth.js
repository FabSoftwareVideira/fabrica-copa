function createAuthMiddleware({ get, jwt, JWT_SECRET, ROLE_PLAYER }) {
    return async function authMiddleware(req, res, next) {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Token ausente", code: "TOKEN_MISSING" });

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            const dbUser = await get(
                "SELECT id, name, email, role, is_blocked FROM users WHERE id = ?",
                [payload.sub],
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
    };
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

module.exports = {
    createAuthMiddleware,
    requireRoles,
};
