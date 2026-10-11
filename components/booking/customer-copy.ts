/**
 * Textos novos da tela pública, num só lugar para revisão.
 * A interface lê daqui. Não mostrar `Error.message` cru no lugar destas frases.
 */

export const REFUND_PENDING_TITLE = "Pagamento em devolução";

export const REFUNDED_TITLE = "Pagamento devolvido";

export function refundPendingBody(amountLabel: string): string {
  return `Seu Pix chegou depois que o horário foi liberado. Estamos devolvendo ${amountLabel} para a conta que fez o pagamento.`;
}

export function refundedBody(amountLabel: string): string {
  return `Devolvemos ${amountLabel} para a conta que fez o Pix. Confira no extrato do seu banco.`;
}

export const SLOTS_LOAD_COPY = "Não foi possível carregar os horários. Tente de novo em instantes.";

export const SUBMIT_RETRY_COPY = "Não conseguimos concluir agora. Tente de novo em instantes.";

/** Mercado Pago não criou o Pix. Os dados do formulário continuam na tela. */
export const PIX_CREATE_FAILED_COPY = "Não conseguimos gerar o Pix agora. Seus dados continuam salvos, é só tocar em Gerar Pix de novo.";

/** Segunda falha na mesma visita. Vira link só quando a loja tem WhatsApp. */
export const PIX_CREATE_FAILED_STORE = "Se continuar, fale com a loja";

export const BUSINESS_NOT_FOUND_COPY = "Estabelecimento não encontrado. Verifique o link informado.";

/** 404 do acompanhamento. Não diz que o horário foi confirmado. */
export const TRACKING_LINK_UPDATED = "Este link de acompanhamento foi atualizado. Para ver os detalhes do seu agendamento, fale com a loja.";

/** Quando a rota não tem slug (ou não há WhatsApp para abrir). */
export const TRACKING_ASK_STORE = "Procure a mensagem da loja no seu WhatsApp para falar com ela.";

export const TALK_TO_STORE = "Falar com a loja";

/** 403 `bookings_paused` na página pública. Não cita assinatura nem pagamento do dono. */
export const BOOKINGS_PAUSED_COPY = "Esta agenda não está aceitando novos agendamentos agora.";

export const BOOKINGS_PAUSED_LATER = "Tente de novo mais tarde.";

export const BOOKINGS_PAUSED_RECEIPT = "Já agendou? Seu comprovante continua valendo.";

export const BUSINESS_LOAD_COPY = "Não foi possível carregar os serviços deste estabelecimento.";

export const BUSINESS_SLOW_COPY = "A conexão demorou muito para responder. Verifique sua internet e tente novamente.";

/** Botão de WhatsApp quando o número existe e o nome do negócio não. */
export const WHATSAPP_CONTACT_LABEL = "Falar no WhatsApp";
