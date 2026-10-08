import type { DepositPolicy } from "../policy/schema";
import { ownerPreview, policyDetails, policySummary, type PolicyDetailLine } from "../policy/text";

/** O que o cliente lê vem de policySummary e policyDetails. ownerPreview fica só no aviso do dono. */
export function policyPreviewCopy(
  policy: DepositPolicy,
  businessName: string,
  depositCents: number,
  contactWhatsapp: string | null = null,
) {
  return {
    summary: policySummary(policy, { depositCents, businessName }),
    details: depositCents > 0
      ? policyDetails(policy, { businessName, contactWhatsapp, timezone: "America/Sao_Paulo" })
      : [],
    owner: ownerPreview(policy, { depositCents }),
  };
}

export function customerPreviewText(summary: string, details: PolicyDetailLine[]) {
  return [summary, ...details.map((line) => `${line.title}. ${line.body}`)].join(" ");
}

const ARTICLE_BEFORE_NAME = String.raw`(?:^|\s)(?:[OoAa]|[Dd]o|[Dd]a|[Nn]o|[Nn]a|[Pp]elo|[Pp]ela|com o|com a)\s+`;

export function hasArticleBeforeBusiness(text: string, businessName: string) {
  const name = businessName.trim();
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${ARTICLE_BEFORE_NAME}${escaped}\\b`).test(text);
}
