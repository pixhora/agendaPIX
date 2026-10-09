/** Placeholders `[…]` só aparecem com a flag ligada. Em produção ela fica desligada. */
export function showPendingBlocks(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PENDING === "true";
}

/** Termos e privacidade ficam fora do ar até a aprovação jurídica. */
export function legalPagesPublished(): boolean {
  return process.env.LEGAL_PAGES_PUBLISHED === "true";
}

/** Link de privacidade do passo de dados. Some quando a flag está desligada. */
export function privacyPolicyLink(published: boolean): { href: "/privacidade"; label: "Política de Privacidade" } | null {
  if (!published) return null;
  return { href: "/privacidade", label: "Política de Privacidade" };
}
