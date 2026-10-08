import type { DepositPolicy } from "../policy/schema";
import { ownerPreview, policySummary } from "../policy/text";

/** Texto que o cliente lê. Só as funções de lib/policy/text, sem frase montada aqui. */
export function policyPreviewCopy(policy: DepositPolicy, businessName: string, depositCents: number) {
  return {
    summary: policySummary(policy, { depositCents, businessName }),
    preview: ownerPreview(policy, { businessName, depositCents }),
  };
}

const ARTICLE_BEFORE_NAME = String.raw`(?:^|\s)(?:[OoAa]|[Dd]o|[Dd]a|[Nn]o|[Nn]a|[Pp]elo|[Pp]ela|com o|com a)\s+`;

export function hasArticleBeforeBusiness(text: string, businessName: string) {
  const name = businessName.trim();
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${ARTICLE_BEFORE_NAME}${escaped}\\b`).test(text);
}
