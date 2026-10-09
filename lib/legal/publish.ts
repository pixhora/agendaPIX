/**
 * Placeholder ainda não resolvido: começa com maiúscula e segue em caixa alta,
 * como [NOME COMPLETO] ou [ATUALIZAR SE O CÓDIGO MUDAR: ...].
 * Link markdown comum ([Política de Privacidade](/privacidade)) não entra.
 */
const UNRESOLVED_PLACEHOLDER = /\[[A-ZÀ-Ú][A-ZÀ-Ú0-9 ,:;()\-çãõáéíóú]{3,}/g;

const DRAFT_BANNER = "Rascunho para revisão";

export function legalPublicationProblems(markdown: string): string[] {
  const problems: string[] = [];
  if (markdown.includes(DRAFT_BANNER)) problems.push(DRAFT_BANNER);
  const placeholders = markdown.match(UNRESOLVED_PLACEHOLDER) ?? [];
  for (const placeholder of placeholders) {
    if (!problems.includes(placeholder)) problems.push(placeholder);
  }
  return problems;
}

/** Com a flag desligada, o rascunho pode existir. Ligada, rascunho ou placeholder derruba o build. */
export function assertLegalPublicationAllowed(markdown: string, published: boolean, source: string): void {
  if (!published) return;
  const problems = legalPublicationProblems(markdown);
  if (problems.length === 0) return;
  throw new Error(
    `Não publique ${source}: ainda há rascunho ou placeholder. Resolva antes de ligar LEGAL_PAGES_PUBLISHED. Pendências: ${problems.join("; ")}`,
  );
}
