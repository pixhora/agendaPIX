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

export function disconnectedConfirmedNotice(input: { customerName: string; serviceName: string; when: string }): OwnerNotice {
  return {
    subject: "Sinal confirmado com o Mercado Pago desconectado",
    text: `Você recebeu um sinal via Pix de ${input.customerName} para ${input.serviceName} em ${input.when}, mas sua conta Mercado Pago está desconectada do AgendaPix. O agendamento foi confirmado. Reconecte para receber novos sinais.`,
  };
}

export function lateRefundedNotice(input: { customerName: string; serviceName: string; when: string }): OwnerNotice {
  return {
    subject: "Sinal devolvido pelo AgendaPix",
    text: `O cliente ${input.customerName} pagou o sinal de ${input.serviceName} (${input.when}) fora do prazo e não havia horário livre. O AgendaPix devolveu o valor automaticamente.`,
  };
}

export function lateRefundFailedNotice(input: { customerName: string; serviceName: string; when: string }): OwnerNotice {
  return {
    subject: "Devolva um sinal pelo AgendaPix",
    text: `O cliente ${input.customerName} pagou o sinal de ${input.serviceName} (${input.when}) fora do prazo e não havia horário livre. Não foi possível devolver o valor automaticamente. Devolva pelo AgendaPix, no botão Devolver pelo AgendaPix, ou pelo app do Mercado Pago.`,
  };
}

export function lateRefundNoTokenNotice(input: { customerName: string; serviceName: string; when: string }): OwnerNotice {
  return {
    subject: "Confira um sinal no Mercado Pago",
    text: `O cliente ${input.customerName} pagou o sinal de ${input.serviceName} (${input.when}) fora do prazo e não havia horário livre. O AgendaPix não conseguiu devolver o valor porque a conta Mercado Pago está desvinculada. Confira no app do Mercado Pago ou reconecte e use o botão Devolver pelo AgendaPix.`,
  };
}

export function unverifiableSellerNotice(): OwnerNotice {
  return {
    subject: "Confira um Pix no Mercado Pago",
    text: "O AgendaPix recebeu um aviso de pagamento, mas a conta Mercado Pago está desvinculada e não dá para confirmar o Pix. Confira no app do Mercado Pago e confirme o horário ou devolva o valor manualmente.",
  };
}
