"use strict";

/**
 * @param {object} deps
 * @param {Function} deps.run
 * @param {object} deps.jwt
 * @param {string} deps.JWT_SECRET
 * @param {string} deps.ACCESS_TOKEN_TTL
 * @param {number} deps.REFRESH_TOKEN_TTL_DAYS
 * @param {object} deps.crypto
 * @param {Function} deps.addDaysISO
 * @param {Function} deps.nowSqlTimestamp
 */
function createTokenService({ run, jwt, JWT_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, crypto, addDaysISO, nowSqlTimestamp }) {
    function signAccessToken(user) {
        return jwt.sign(
            { sub: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_TTL }
        );
    }

    function makeRefreshToken() {
        return crypto.randomBytes(48).toString("hex");
    }

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

    return { signAccessToken, createRefreshToken, revokeRefreshToken };
}

module.exports = { createTokenService };