/** Erro de saldo. Nenhuma tela devolve pelo AgendaPix: o dono usa o app do Mercado Pago. */
export const INSUFFICIENT_BALANCE_MESSAGE =
  "Sua conta Mercado Pago não tem saldo disponível para essa devolução. Coloque saldo e devolva pelo app do Mercado Pago.";

export function insufficientBalance(cause: string) {
  return /insufficient|saldo insuficiente/i.test(cause);
}
