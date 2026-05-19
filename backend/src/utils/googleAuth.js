"use strict";

/**
 * @param {object} deps
 * @param {object} deps.googleOAuthClient
 * @param {string|undefined} deps.GOOGLE_CLIENT_ID
 * @param {string} deps.ROLE_ADMIN
 * @param {string} deps.ROLE_SERVIDOR
 * @param {string} deps.ROLE_PLAYER
 */
function createGoogleAuthUtils({ googleOAuthClient, GOOGLE_CLIENT_ID, ROLE_ADMIN, ROLE_SERVIDOR, ROLE_PLAYER }) {
    async function verifyGoogleIdToken(idToken) {
        if (!GOOGLE_CLIENT_ID) {
            const err = new Error("GOOGLE_CLIENT_ID nao configurado no backend");
            err.code = "GOOGLE_CONFIG_MISSING";
            throw err;
        }

        const ticket = await googleOAuthClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });

        return ticket.getPayload() || {};
    }

    /**
     * Derives a role from a Google email address.
     * IFC institutional emails are promoted to ROLE_SERVIDOR unless already ROLE_ADMIN.
     */
    function roleFromGoogleEmail(email, currentRole = ROLE_PLAYER) {
        const cleanEmail = String(email || "").trim().toLowerCase();
        if (cleanEmail.endsWith("@ifc.edu.br")) {
            if (currentRole === ROLE_ADMIN) return ROLE_ADMIN;
            return ROLE_SERVIDOR;
        }
        return currentRole || ROLE_PLAYER;
    }

    return { verifyGoogleIdToken, roleFromGoogleEmail };
}

module.exports = { createGoogleAuthUtils };