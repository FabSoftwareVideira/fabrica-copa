"use strict";

const { sendMail } = require("../utils/email");
const { getAllUserEmails } = require("../utils/user");

class TradeWindowEmailNotifier {
    constructor({ all, logError, FRONTEND_URL }) {
        this.all = all;
        this.logError = logError;
        this.FRONTEND_URL = FRONTEND_URL;
    }

    async sendTradeWindowOpenedEmails({ endsAtFormatted }) {
        try {
            console.log(`[Watcher] Buscando e-mails de usuários para notificação...`);
            const emails = await getAllUserEmails(this.all);
            console.log(`[Watcher] Total de e-mails encontrados: ${emails?.length || 0}`);

            if (emails && emails.length > 0) {
                const uniqueEmails = [];
                const seenEmails = new Set();
                for (const email of emails) {
                    if (!email || typeof email !== "string") {
                        continue;
                    }

                    const normalizedEmail = email.trim().toLowerCase();
                    if (!normalizedEmail || seenEmails.has(normalizedEmail)) {
                        continue;
                    }

                    seenEmails.add(normalizedEmail);
                    uniqueEmails.push(email.trim());
                }

                const subject = "Janela de trocas aberta!";
                const text = `A janela de trocas do álbum está aberta até ${endsAtFormatted}!\n\nAcesse agora: ${this.FRONTEND_URL}\n\nAproveite para negociar suas figurinhas com outros colecionadores!`;
                const html = `<p style='font-size:1.1em'>A janela de trocas do álbum está <b>aberta até ${endsAtFormatted}</b>!</p>\n<p><a href='${this.FRONTEND_URL}' style='background:#10a3ae;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;'>Acessar plataforma</a></p>\n<p style='color:#444'>Aproveite para negociar suas figurinhas com outros colecionadores.<br>Se não deseja mais receber estes avisos, acesse seu perfil e desative a opção de e-mail.</p>`;

                // Define o destinatário principal (em dev, usa um fallback caso o GMAIL_USER não esteja setado)
                const to = process.env.GMAIL_USER;
                const maxBccPerEmail = 100;

                for (let i = 0; i < uniqueEmails.length; i += maxBccPerEmail) {
                    const bccBatch = uniqueEmails.slice(i, i + maxBccPerEmail);
                    const batchNumber = Math.floor(i / maxBccPerEmail) + 1;

                    console.log(
                        `[Watcher] Enviando lote ${batchNumber} para ${to} com BCC para ${bccBatch.length} usuários...`
                    );

                    try {
                        const result = await sendMail({ to, bcc: bccBatch, subject, text, html });
                        console.log(`[Watcher] Lote ${batchNumber} enviado:`, result.messageId);
                    } catch (err) {
                        console.error(
                            `[Watcher] Erro ao enviar lote ${batchNumber} de e-mails de notificação de janela de trocas:`,
                            err
                        );
                    }
                }
            } else {
                console.log(`[Watcher] Nenhum e-mail encontrado para notificação.`);
            }
        } catch (err) {
            this.logError("[Watcher] Falha ao enviar e-mails de notificação de janela de trocas", { err });
        }
    }
}

module.exports = { TradeWindowEmailNotifier };