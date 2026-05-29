// Serviço para notificar usuários sobre propostas de troca por e-mail
const { sendMail } = require("../utils/email");
const { TRADE_COINS_PER_TRADE } = require("../config/constants");

class TradeOfferNotifier {
    /**
     * Envia notificação de proposta de troca por e-mail
     * @param {Object} params
     * @param {string} params.toEmail - E-mail do destinatário
     * @param {string} params.toName - Nome do destinatário
     * @param {string} params.fromName - Nome do usuário que enviou a proposta
     * @param {string} params.offeredStickerName - Nome da figurinha oferecida
     * @param {string} params.requestedStickerName - Nome da figurinha solicitada
     */
    static async notifyTradeOffer({ toEmail, toName, fromName, offeredStickerName, requestedStickerName }) {
        if (!toEmail) return;
        const subject = "Você recebeu uma proposta de troca de figurinhas!";
        const frontendUrl = process.env.FRONTEND_URL;
        const coinsMsg = `Ao aceitar, você receberá ${TRADE_COINS_PER_TRADE} moedas no álbum!`;
        const text = `Olá ${toName || "usuário"},\n\nVocê recebeu uma nova proposta de troca de figurinhas de ${fromName}.\n\nOferta: ${offeredStickerName} por ${requestedStickerName}.\n${coinsMsg}\n\nAcesse a janela de trocas para aceitar ou recusar a proposta:\n${frontendUrl}\n\nEquipe Fábrica da Copa`;
        const html = `<p>Olá ${toName || "usuário"},</p><p>Você recebeu uma nova proposta de troca de figurinhas de <b>${fromName}</b>.</p><p><b>Oferta:</b> ${offeredStickerName} por ${requestedStickerName}.</p><p style='color:#0a7'><b>${coinsMsg}</b></p><p><a href='${frontendUrl}' style='background:#10a3ae;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;'>Acessar plataforma</a></p><p style='color:#444'>Acesse a janela de trocas para aceitar ou recusar a proposta.<br>Equipe Fábrica da Copa</p>`;
        // Não aguarda o envio do e-mail, apenas dispara
        sendMail({ to: toEmail, subject, text, html })
            .catch((err) => console.error("[TradeOfferNotifier] Falha ao enviar email de proposta de troca:", err));
    }
}

module.exports = TradeOfferNotifier;
