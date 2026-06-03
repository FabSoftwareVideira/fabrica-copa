const express = require("express");
const { normalizePrestigeLevel, getPrestigeBonusMultiplier } = require("../utils/prestige");

function createProfileRoutes({ get, run, authMiddleware }) {
    const router = express.Router();

    // Obter dados do perfil do usuário logado
    router.get("/profile", authMiddleware, async (req, res) => {
        try {
            const row = await get(
                `SELECT u.id, u.name, u.email, u.role, u.is_blocked, u.wants_emails, u.created_at,
                        a.prestige_level, a.completed_at, a.last_prestige_at
                 FROM users u
                 LEFT JOIN album_states a ON a.user_id = u.id
                 WHERE u.id = ?`,
                [req.user.sub]
            );
            if (!row) return res.status(404).json({ error: "Usuário não encontrado" });

            const prestigeLevel = normalizePrestigeLevel(row.prestige_level || 0);
            return res.json({
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
                isBlocked: !!row.is_blocked,
                wantsEmails: !!row.wants_emails,
                createdAt: row.created_at,
                albumCompleted: String(row.completed_at || "").trim() !== "",
                albumCompletedAt: row.completed_at || "",
                prestigeLevel,
                prestigeBonusMultiplier: getPrestigeBonusMultiplier(prestigeLevel),
                lastPrestigeAt: row.last_prestige_at || "",
            });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao carregar perfil", detail: err.message });
        }
    });

    // Atualizar preferência de recebimento de e-mails
    router.patch("/profile/email-preference", authMiddleware, async (req, res) => {
        try {
            const wantsEmails = req.body?.wantsEmails === true;
            await run("UPDATE users SET wants_emails = ? WHERE id = ?", [wantsEmails ? 1 : 0, req.user.sub]);
            return res.json({ ok: true, wantsEmails });
        } catch (err) {
            return res.status(500).json({ error: "Erro ao atualizar preferência", detail: err.message });
        }
    });

    return router;
}

module.exports = { createProfileRoutes };