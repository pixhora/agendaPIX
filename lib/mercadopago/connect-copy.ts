/** Textos da tela de conexão (spec v3.4). A versão do aceite continua 2026-10-08.v3.2. */

export const MP_AUTO_REFUND_ACK_TEXT =
  "Entendi e autorizo: quando um Pix chegar depois do prazo e o horário já estiver ocupado, o AgendaPix devolve sozinho o valor inteiro, do saldo da minha conta Mercado Pago, e me avisa por e-mail. Se essa devolução falhar, eu devolvo manualmente em até 7 dias corridos, contados do aviso.";

export const MP_AUTO_REFUND_ACK_HINT =
  "Obrigatório para conectar. Essa devolução é regra do AgendaPix para proteger seus clientes e não pode ser desligada.";

export const MP_AUTO_REFUND_ACK_ERROR = "Marque a autorização da devolução automática para continuar.";

export const MP_GOOD_TO_KNOW = [
  "A tarifa do Pix é do Mercado Pago e é descontada da sua conta, conforme o seu contrato com ele.",
  "Devoluções, contestações e MED acontecem na sua conta Mercado Pago. Devoluções dependem de saldo disponível e valem até 180 dias depois do pagamento (regras do Mercado Pago). Se uma devolução automática falhar, você é avisado e devolve manualmente em até 7 dias corridos, contados do aviso.",
  "Se você desvincular o AgendaPix direto no Mercado Pago, podemos não conseguir verificar pagamentos: nesse caso, mandamos um e-mail para você conferir e resolver na sua conta.",
  "Conecte uma conta sua (ou do seu negócio), com uma chave Pix cadastrada. É nela que os clientes vão pagar.",
  "Você pode desconectar quando quiser, aqui no AgendaPix ou no Mercado Pago. Sem conexão, os serviços com sinal ficam pausados.",
] as const;

/** Sexta, 16 out 2026, meio-dia em São Paulo. */
export const MP_MOCK_FRIDAY_16 = "2026-10-16T15:00:00.000Z";

/** Sexta, 23 out 2026, meio-dia em São Paulo. */
export const MP_MOCK_FRIDAY_23 = "2026-10-23T15:00:00.000Z";
