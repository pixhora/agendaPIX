/**
 * PROVISIONAL — será substituído no rebase pelo `lib/slug.ts` do PR de frontend.
 *
 * Assinatura combinada: `normalizeSlug(raw, { final })`.
 * Esta cópia mínima implementa as regras de 03 §4.1 para o endpoint de
 * disponibilidade conseguir normalizar no servidor. Não é a suíte de testes
 * do front (caret, `slugTouched`, tabela completa).
 */
export function normalizeSlug(raw: string, opts: { final: boolean }): string {
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[\s_.&+/\\,;:]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
  return opts.final ? normalized.replace(/-+$/, "") : normalized;
}
