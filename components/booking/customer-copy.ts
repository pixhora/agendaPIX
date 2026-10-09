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

export const BUSINESS_NOT_FOUND_COPY = "Estabelecimento não encontrado. Verifique o link informado.";

export const BUSINESS_LOAD_COPY = "Não foi possível carregar os serviços deste estabelecimento.";

export const BUSINESS_SLOW_COPY = "A conexão demorou muito para responder. Verifique sua internet e tente novamente.";

/** Botão de WhatsApp quando o número existe e o nome do negócio não. */
export const WHATSAPP_CONTACT_LABEL = "Falar no WhatsApp";
