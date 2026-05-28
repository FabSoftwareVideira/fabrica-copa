const express = require("express");

function createProfileRoutes({ get, run, authMiddleware }) {
    const router = express.Router();

    // Obter dados do perfil do usuário logado
    router.get("/profile", authMiddleware, async (req, res) => {
        try {
            const row = await get("SELECT id, name, email, role, is_blocked, wants_emails, created_at FROM users WHERE id = ?", [req.user.sub]);
            if (!row) return res.status(404).json({ error: "Usuário não encontrado" });
            return res.json({
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
                isBlocked: !!row.is_blocked,
                wantsEmails: !!row.wants_emails,
                createdAt: row.created_at,
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