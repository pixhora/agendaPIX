/** Textos da tela de conexão além do aceite. O texto da caixa vem de `MP_CONNECT_CONSENT_TEXT`. */

/** Devolução manual: o dono faz no app do Mercado Pago, não num botão do AgendaPix. */
export const MP_MANUAL_REFUND_CHANNEL = "Você devolve pelo app do Mercado Pago.";

/**
 * Frase antiga. Prometia guardar o acesso por mais 24 horas depois do vencimento do Pix.
 * O código apaga assim que não há Pix em aberto, com teto de 24 horas na tela. Não usar na interface.
 */
export const MP_DISCONNECT_RETENTION_COPY =
  "Até o Pix vencer e por mais 24 horas, guardamos o acesso só para confirmar ou devolver esse sinal. O apagamento roda no processamento diário, então pode levar até cerca de um dia a mais.";

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

/** Sexta, 2 out 2026, meio-dia em São Paulo. Anterior a 8 out 2026. */
export const MP_MOCK_FRIDAY_2 = "2026-10-02T15:00:00.000Z";

/** Sexta, 25 set 2026, meio-dia em São Paulo. */
export const MP_MOCK_FRIDAY_25 = "2026-09-25T15:00:00.000Z";
