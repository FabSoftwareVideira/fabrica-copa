
// Função utilitária para buscar e-mails dos usuários que querem receber e-mails e não estão bloqueados
async function getAllUserEmails(all) {
    const rows = await all('SELECT email FROM users WHERE is_blocked = false AND wants_emails = 1');
    return rows.map(r => r.email);
}

module.exports = { getAllUserEmails };