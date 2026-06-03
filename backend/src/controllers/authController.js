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
    todayStr,
    DAILY_LOGIN_BONUS_COINS,
    DAILY_LOGIN_BONUS_PACKS,
}) {
    async function grantDailyLoginBonus(userId) {
        const today = todayStr();
        const updatedAt = nowSqlTimestamp();
        await run("INSERT OR IGNORE INTO album_states(user_id) VALUES(?)", [userId]);
        const result = await run(
            `UPDATE album_states
             SET trade_coins = trade_coins + ?,
                 extra_packs = extra_packs + ?,
                 last_login_bonus_date = ?,
                 updated_at = ?
             WHERE user_id = ?
               AND (last_login_bonus_date IS NULL OR last_login_bonus_date <> ?)`,
            [
                Number(DAILY_LOGIN_BONUS_COINS || 0),
                Number(DAILY_LOGIN_BONUS_PACKS || 0),
                today,
                updatedAt,
                userId,
                today,
            ]
        );

        const granted = Number(result?.changes || 0) > 0;
        return {
            granted,
            coins: granted ? Number(DAILY_LOGIN_BONUS_COINS || 0) : 0,
            packs: granted ? Number(DAILY_LOGIN_BONUS_PACKS || 0) : 0,
            date: today,
        };
    }


    async function registerDisabled(_req, res) {
        return res.status(410).json({ error: "Cadastro por email/senha desativado. Use login com Google." });
    }

    async function loginDisabled(_req, res) {
        return res.status(410).json({ error: "Login por email/senha desativado. Use login com Google." });
    }

    // Endpoint de login de teste (apenas para desenvolvimento)
    async function testLogin(req, res) {
        req.auditContext = {
            action: "auth.login.test",
            accessChannel: "test_login",
            browserName: "Development",
        };

        if (process.env.NODE_ENV !== "development") {
            req.auditContext.success = false;
            return res.status(403).json({ error: "Endpoint restrito ao ambiente de desenvolvimento" });
        }
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email) {
            req.auditContext.success = false;
            return res.status(400).json({ error: "Email obrigatorio" });
        }

        let userRow = await get(
            "SELECT id, name, email, role, is_blocked FROM users WHERE email = ?",
            [email],
        );

        if (!userRow) {
            // Cria usuário fake se não existir
            const name = email.split("@")[0] || "Teste";
            const pseudoPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
            const created = await run(
                "INSERT INTO users(name, email, password_hash, role) VALUES(?, ?, ?, ?)",
                [name, email, pseudoPasswordHash, ROLE_PLAYER],
            );
            userRow = {
                id: created.lastID,
                name,
                email,
                role: ROLE_PLAYER,
                is_blocked: 0,
            };
        } else {
            if (Number(userRow.is_blocked || 0) === 1) {
                req.auditContext.success = false;
                return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador." });
            }
        }

        const dailyBonus = await grantDailyLoginBonus(userRow.id);

        const user = {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            role: userRow.role || ROLE_PLAYER,
        };
        req.auditContext.userId = user.id;
        req.auditContext.userName = user.name;
        req.auditContext.userEmail = user.email;
        req.auditContext.userRole = user.role;
        req.auditContext.success = true;
        const accessToken = signAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);

        return res.json({
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: ACCESS_TOKEN_TTL,
            user,
            dailyBonus,
            testLogin: true,
        });
    }

    async function authGoogle(req, res) {
        try {
            req.auditContext = {
                action: "auth.login.google",
                accessChannel: "google_oauth",
            };

            const idToken = String(req.body?.idToken || "").trim();
            if (!idToken) {
                req.auditContext.success = false;
                return res.status(400).json({ error: "idToken obrigatorio" });
            }

            const googleProfile = await verifyGoogleIdToken(idToken);
            const cleanEmail = String(googleProfile.email || "").trim().toLowerCase();
            const cleanName = String(googleProfile.name || "").trim() || cleanEmail.split("@")[0] || "Usuario";
            const emailVerified = Boolean(googleProfile.email_verified);

            if (!cleanEmail || !emailVerified) {
                req.auditContext.success = false;
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

                userRow = {
                    id: created.lastID,
                    name: cleanName,
                    email: cleanEmail,
                    role: initialRole,
                    is_blocked: 0,
                };
            } else {
                if (Number(userRow.is_blocked || 0) === 1) {
                    req.auditContext.success = false;
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
            }

            const dailyBonus = await grantDailyLoginBonus(userRow.id);

            const user = {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                role: userRow.role || ROLE_PLAYER,
            };
            req.auditContext.userId = user.id;
            req.auditContext.userName = user.name;
            req.auditContext.userEmail = user.email;
            req.auditContext.userRole = user.role;
            req.auditContext.success = true;
            const accessToken = signAccessToken(user);
            const refreshToken = await createRefreshToken(user.id);

            return res.json({
                accessToken,
                refreshToken,
                tokenType: "Bearer",
                expiresIn: ACCESS_TOKEN_TTL,
                user,
                dailyBonus,
            });
        } catch (err) {
            if (err?.code === "GOOGLE_CONFIG_MISSING") {
                req.auditContext = req.auditContext || { action: "auth.login.google", accessChannel: "google_oauth" };
                req.auditContext.success = false;
                return res.status(500).json({ error: "Google OAuth nao configurado no servidor" });
            }
            req.auditContext = req.auditContext || { action: "auth.login.google", accessChannel: "google_oauth" };
            req.auditContext.success = false;
            return res.status(401).json({ error: "Falha na autenticacao Google", detail: err.message });
        }
    }

    async function authRefresh(req, res) {
        try {
            req.auditContext = {
                action: "auth.refresh",
                accessChannel: "refresh_token",
            };

            const refreshToken = String(req.body?.refreshToken || "");
            if (!refreshToken) {
                req.auditContext.success = false;
                return res.status(400).json({ error: "refreshToken obrigatorio" });
            }

            const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
            const row = await get(
                `SELECT rt.user_id, rt.expires_at, rt.revoked, u.name, u.email, u.role, u.is_blocked
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ?`,
                [tokenHash],
            );

            if (!row || row.revoked) {
                req.auditContext.success = false;
                return res.status(401).json({ error: "Refresh token invalido", code: "REFRESH_INVALID" });
            }
            if (new Date(row.expires_at).getTime() <= Date.now()) {
                await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
                req.auditContext.success = false;
                return res.status(401).json({ error: "Refresh token expirado", code: "REFRESH_EXPIRED" });
            }
            if (Number(row.is_blocked || 0) === 1) {
                await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
                req.auditContext.success = false;
                return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador.", code: "USER_BLOCKED" });
            }

            const dailyBonus = await grantDailyLoginBonus(row.user_id);

            await run("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [tokenHash]);
            const user = { id: row.user_id, name: row.name, email: row.email, role: row.role || ROLE_PLAYER };
            req.auditContext.userId = user.id;
            req.auditContext.userName = user.name;
            req.auditContext.userEmail = user.email;
            req.auditContext.userRole = user.role;
            req.auditContext.success = true;
            const accessToken = signAccessToken(user);
            const newRefreshToken = await createRefreshToken(user.id);

            return res.json({
                accessToken,
                refreshToken: newRefreshToken,
                tokenType: "Bearer",
                expiresIn: ACCESS_TOKEN_TTL,
                user,
                dailyBonus,
            });
        } catch (err) {
            req.auditContext = req.auditContext || { action: "auth.refresh", accessChannel: "refresh_token" };
            req.auditContext.success = false;
            return res.status(500).json({ error: "Erro no refresh", detail: err.message });
        }
    }

    async function authLogout(req, res) {
        try {
            req.auditContext = {
                action: "auth.logout",
                accessChannel: "logout",
                success: true,
                userId: req.user?.sub,
                userName: req.user?.name,
                userEmail: req.user?.email,
                userRole: req.user?.role,
            };
            const refreshToken = String(req.body?.refreshToken || "");
            if (refreshToken) {
                await revokeRefreshToken(refreshToken);
            }
            return res.json({ ok: true });
        } catch (err) {
            req.auditContext = req.auditContext || { action: "auth.logout", accessChannel: "logout" };
            req.auditContext.success = false;
            return res.status(500).json({ error: "Erro no logout", detail: err.message });
        }
    }

    async function authMe(req, res) {
        try {
            const row = await get("SELECT id, name, email, role, is_blocked FROM users WHERE id = ?", [req.user.sub]);
            if (!row) return res.status(404).json({ error: "Usuario nao encontrado" });
            if (Number(row.is_blocked || 0) === 1) {
                return res.status(403).json({ error: "Acesso bloqueado. Contate o administrador." });
            }

            const dailyBonus = await grantDailyLoginBonus(row.id);

            return res.json({ user: sanitizeUser(row), dailyBonus });
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
        testLogin,
    };
}

module.exports = {
    createAuthController,
};
