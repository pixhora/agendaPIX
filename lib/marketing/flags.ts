/** Placeholders `[…]` só aparecem com a flag ligada. Em produção ela fica desligada. */
export function showPendingBlocks(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PENDING === "true";
}

/** Termos e privacidade ficam fora do ar até a aprovação jurídica. */
export function legalPagesPublished(): boolean {
  return process.env.LEGAL_PAGES_PUBLISHED === "true";
}
