function createAuthController({
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
}) {
    async function registerDisabled(_req, res) {
        return res.status(410).json({ error: "Cadastro por email/senha desativado. Use login com Google." });
    }

    async function loginDisabled(_req, res) {
        return res.status(410).json({ error: "Login por email/senha desativado. Use login com Google." });
    }

    async function authGoogle(req, res) {
        try {
            const idToken = String(req.body?.idToken || "").trim();
            if (!idToken) return res.status(400).json({ error: "idToken obrigatorio" });

            const googleProfile = await verifyGoogleIdToken(idToken);
            const cleanEmail = String(googleProfile.email || "").trim().toLowerCase();
            const cleanName = String(googleProfile.name || "").trim() || cleanEmail.split("@")[0] || "Usuario";
            const emailVerified = Boolean(googleProfile.email_verified);

            if (!cleanEmail || !emailVerified) {
                return res.status(401).json({ error: "Conta Google invalida para autenticacao" });
            }

            let userRow = await get(
                "SELECT id, name, email, role, is_blocked FROM users WHERE email = ?",
                [cleanEmail],
            );

            if (!userRow) {
                const initialRole = roleFromGoogleEmail(cleanEmail, ROLE_PLAYER);
                const pseudoPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
                const created = await run(
                    "INSERT INTO users(name, email, password_hash, role) VALUES(?, ?, ?, ?)",
                    [cleanName, cleanEmail, pseudoPasswordHash, initialRole],
                );
                await run("INSERT OR IGNORE INTO album_states(user_id) VALUES(?)", [created.lastID]);

                userRow = {
                    id: created.lastID,
                    name: cleanName,
                    email: cleanEmail,
                    role: initialRole,
                    is_blocked: 0,
                };
            } else {
                if (Number(userRow.is_blocked || 0) === 1) {
                    return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador." });
                }

                const targetRole = roleFromGoogleEmail(cleanEmail, userRow.role || ROLE_PLAYER);
                if (targetRole !== (userRow.role || ROLE_PLAYER)) {
                    await run("UPDATE users SET role = ? WHERE id = ?", [targetRole, userRow.id]);
                    userRow.role = targetRole;
                }

                if (cleanName && cleanName !== userRow.name) {
                    await run("UPDATE users SET name = ? WHERE id = ?", [cleanName, userRow.id]);
                    userRow.name = cleanName;
                }

                await run("INSERT OR IGNORE INTO album_states(user_id) VALUES(?)", [userRow.id]);
            }

            const user = {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                role: userRow.role || ROLE_PLAYER,
            };
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
            if (err?.code === "GOOGLE_CONFIG_MISSING") {
                return res.status(500).json({ error: "Google OAuth nao configurado no servidor" });
            }
            return res.status(401).json({ error: "Falha na autenticacao Google", detail: err.message });
        }
    }

    async function authRefresh(req, res) {
        try {
            const refreshToken = String(req.body?.refreshToken || "");
            if (!refreshToken) return res.status(400).json({ error: "refreshToken obrigatorio" });

            const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
            const row = await get(
                `SELECT rt.user_id, rt.expires_at, rt.revoked, u.name, u.email, u.role, u.is_blocked
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ?`,
                [tokenHash],
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
    }

    async function authLogout(req, res) {
        try {
            const refreshToken = String(req.body?.refreshToken || "");
            if (refreshToken) {
                await revokeRefreshToken(refreshToken);
            }
            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: "Erro no logout", detail: err.message });
        }
    }

    async function authMe(req, res) {
        try {
            const row = await get("SELECT id, name, email, role, is_blocked FROM users WHERE id = ?", [req.user.sub]);
            if (!row) return res.status(404).json({ error: "Usuario nao encontrado" });
            return res.json({ user: sanitizeUser(row) });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao buscar usuario", detail: err.message });
        }
    }

    return {
        registerDisabled,
        loginDisabled,
        authGoogle,
        authRefresh,
        authLogout,
        authMe,
    };
}

module.exports = {
    createAuthController,
};
