/**
 * Decisão de produto ainda pendente (vários negócios por dono).
 * Só a string exata "true" liga a trava no commit do rascunho.
 * Qualquer outro valor, inclusive ausente, mantém o comportamento atual.
 */
export function oneBusinessPerOwner(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.ONE_BUSINESS_PER_OWNER === "true";
}
