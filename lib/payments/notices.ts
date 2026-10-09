export function formatAppointment(startsAt: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(startsAt);
}

export function maskEmail(email: string | null | undefined) {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export type OwnerNotice = { subject: string; text: string };

/** `window_expired`: política `refund` (ou o horário já passou). `slot_taken`: `rebook_if_free` com o horário ocupado. */
export type LateRefundCause = "window_expired" | "slot_taken";

export function lateRefundCause(detail: Record<string, unknown> | null | undefined): LateRefundCause {
  return detail?.cause === "slot_taken" ? "slot_taken" : "window_expired";
}

export function lateRefundReason(cause: LateRefundCause = "window_expired") {
  if (cause === "slot_taken") return "depois do prazo e o horário já estava ocupado";
  return "depois que o prazo para reservar o horário acabou";
}

export function disconnectedConfirmedNotice(input: { customerName: string; serviceName: string; when: string }): OwnerNotice {
  return {
    subject: "Sinal confirmado com o Mercado Pago desconectado",
    text: `Você recebeu um sinal via Pix de ${input.customerName} para ${input.serviceName} em ${input.when}, mas sua conta Mercado Pago está desconectada do AgendaPix. O agendamento foi confirmado. Reconecte para receber novos sinais.`,
  };
}

function latePaymentSentence(input: { customerName: string; serviceName: string; when: string; cause?: LateRefundCause }) {
  return `O cliente ${input.customerName} pagou o sinal de ${input.serviceName} (${input.when}) ${lateRefundReason(input.cause)}.`;
}

export function lateRefundedNotice(input: { customerName: string; serviceName: string; when: string; cause?: LateRefundCause }): OwnerNotice {
  return {
    subject: "Sinal devolvido pelo AgendaPix",
    text: `${latePaymentSentence(input)} O AgendaPix devolveu o valor automaticamente.`,
  };
}

const manualRefundLine = (deadlineLabel: string) =>
  `Devolva até ${deadlineLabel} (7 dias depois deste aviso) pelo AgendaPix, no botão Devolver pelo AgendaPix, ou pelo app do Mercado Pago.`;

export function lateRefundFailedNotice(input: { customerName: string; serviceName: string; when: string; deadlineLabel: string; cause?: LateRefundCause }): OwnerNotice {
  return {
    subject: "Devolva um sinal pelo AgendaPix",
    text: `${latePaymentSentence(input)} Não foi possível devolver o valor automaticamente. ${manualRefundLine(input.deadlineLabel)}`,
  };
}

export function lateRefundNoTokenNotice(input: { customerName: string; serviceName: string; when: string; deadlineLabel: string; cause?: LateRefundCause }): OwnerNotice {
  return {
    subject: "Confira um sinal no Mercado Pago",
    text: `${latePaymentSentence(input)} O AgendaPix não conseguiu devolver o valor porque a conta Mercado Pago está desvinculada. ${manualRefundLine(input.deadlineLabel)}`,
  };
}

export function unverifiableSellerNotice(input: { deadlineLabel: string }): OwnerNotice {
  return {
    subject: "Confira um Pix no Mercado Pago",
    text: `O AgendaPix recebeu um aviso de pagamento, mas a conta Mercado Pago está desvinculada e não dá para confirmar o Pix. Confira no app do Mercado Pago e confirme o horário ou devolva o valor. ${manualRefundLine(input.deadlineLabel)}`,
  };
}
