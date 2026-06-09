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
        },
        logger: true, // Habilita logs detalhados do Nodemailer
        debug: false   // Habilita debug para ver detalhes da comunicação SMTP
    });
}

/**
 * Envia um e-mail com suporte a múltiplos destinatários em cópia oculta
 * @param {Object} options
 * @param {string} options.to - E-mail do destinatário principal
 * @param {string|string[]} [options.bcc] - E-mail(s) em cópia oculta (string ou array)
 * @param {string} options.subject - Assunto do e-mail
 * @param {string} options.text - Corpo do e-mail (texto)
 * @param {string} [options.html] - Corpo do e-mail (HTML opcional)
 */
async function sendMail({ to, bcc, subject, text, html }) {
    const from = process.env.NODE_ENV === 'production'
        ? process.env.GMAIL_USER
        : 'mailpit@localhost';

    // O Nodemailer aceita o campo 'bcc' tanto como string ("a@b.com, c@d.com") quanto como Array de strings
    const mailOptions = { from, to, bcc, subject, text, html };

    try {
        const info = await transporter.sendMail(mailOptions);

        // Formata o log dependendo se bcc é array ou string
        const bccCount = Array.isArray(bcc) ? bcc.length : (bcc ? 1 : 0);
        console.log(`[Mailer] E-mail enviado com sucesso para: ${to}${bccCount ? ` (+${bccCount} BCC)` : ''}. MessageId: ${info.messageId}`);

        return info;
    } catch (error) {
        console.error(`[Mailer] Erro ao enviar e-mail para ${to}:`, error);
        throw error;
    }
}

module.exports = { sendMail };