export function serviceBlockCopy(reason: string | null) {
  if (!reason) return null;
  if (reason === "bookings_paused") {
    return {
      title: "Novos agendamentos pausados",
      body: "O teste grátis acabou sem assinatura ativa. Este serviço continua cadastrado, mas clientes não conseguem marcar horários novos. A página pública avisa que o agendamento online está pausado.",
    };
  }
  if (reason === "mp_account_not_connected") {
    return {
      title: "Conta Mercado Pago necessária",
      body: "Serviços com sinal precisam de uma conta Mercado Pago conectada. O Pix do sinal cai direto nessa conta.",
    };
  }
  if (reason === "mp_consent_outdated") {
    return {
      title: "Texto da devolução desatualizado",
      body: "Reservas novas com sinal ficam pausadas até você aceitar o texto novo em Recebimento. Pix já gerado e sinais já pagos continuam. A conta Mercado Pago segue conectada.",
    };
  }
  return {
    title: "Serviço indisponível para reserva",
    body: "Este serviço com sinal ainda não pode ser reservado.",
  };
}
