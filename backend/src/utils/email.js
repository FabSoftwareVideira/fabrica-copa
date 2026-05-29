const nodemailer = require('nodemailer');

let transporter;
if (process.env.NODE_ENV === 'development') {
    // Mailpit SMTP local (sem autenticação, sem TLS)
    transporter = nodemailer.createTransport({
        host: process.env.MAILPIT_HOST || 'mailpit',
        port: process.env.MAILPIT_PORT ? Number(process.env.MAILPIT_PORT) : 1025,
        secure: false
        // NÃO adicionar campo 'auth' ou 'tls' aqui!
    });

    // Após criar o transporter, teste a conexão
    transporter.verify((error, success) => {
        if (error) {
            console.error('[Mailer] Falha na conexão SMTP:', error);
        } else {
            console.log('[Mailer] SMTP pronto para envio');
        }
    });
} else {
    // Gmail
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER, // Defina no .env
            pass: process.env.GMAIL_PASS  // Defina no .env (App Password recomendado)
        }
    });
}

/**
 * Envia um e-mail usando o Gmail
 * @param {string} to - E-mail do destinatário
 * @param {string} subject - Assunto do e-mail
 * @param {string} text - Corpo do e-mail (texto)
 * @param {string} [html] - Corpo do e-mail (HTML opcional)
 */
async function sendMail({ to, subject, text, html }) {
    const from = process.env.NODE_ENV === 'production'
        ? process.env.GMAIL_USER
        : 'mailpit@localhost';

    const mailOptions = { from, to, subject, text, html };

    try {
        const info = await transporter.sendMail(mailOptions);
        // Log sutil para auditoria (evite logar o conteúdo por privacidade)
        console.log(`[Mailer] E-mail enviado com sucesso para: ${to}. MessageId: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[Mailer] Erro ao enviar e-mail para ${to}:`, error);
        throw error; // Re-lança o erro para o controlador saber que falhou
    }
}

module.exports = { sendMail };