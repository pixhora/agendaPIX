/** Rótulo único da ação `owner_manual_mark`. O enum não muda. */
export const OWNER_MANUAL_MARK_LABEL = "Devolvi pelo Mercado Pago";

/** Erro de saldo. A orientação é colocar saldo e usar o rótulo da marcação manual. */
export const INSUFFICIENT_BALANCE_MESSAGE =
  `Sua conta Mercado Pago não tem saldo disponível para essa devolução. Coloque saldo e tente de novo e toque em ${OWNER_MANUAL_MARK_LABEL}.`;

export function insufficientBalance(cause: string) {
  return /insufficient|saldo insuficiente/i.test(cause);
}
