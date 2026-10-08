import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasArticleBeforeBusiness, policyPreviewCopy } from "../../lib/dashboard/policy-preview";
import { depositPolicyPresets } from "../../lib/policy/schema";
import { ownerPreview, policySummary } from "../../lib/policy/text";

const BUSINESS = "Studio Bella";

describe("prévia da política no painel", () => {
  it("mostra o texto do cliente sem artigo antes do nome", () => {
    for (const policy of Object.values(depositPolicyPresets)) {
      const copy = policyPreviewCopy(policy, BUSINESS, 2000);
      expect(copy.summary).toBe(policySummary(policy, { depositCents: 2000, businessName: BUSINESS }));
      expect(copy.preview).toBe(ownerPreview(policy, { businessName: BUSINESS, depositCents: 2000 }));
      expect(hasArticleBeforeBusiness(`${copy.summary} ${copy.preview}`, BUSINESS)).toBe(false);
    }
    expect(policyPreviewCopy(depositPolicyPresets.padrao, BUSINESS, 2000).preview).toContain("fica com Studio Bella");
    expect(policyPreviewCopy(depositPolicyPresets.rigida, BUSINESS, 2000).preview).toContain("fica com Studio Bella");
  });

  it("reconhece artigo grudado no nome", () => {
    expect(hasArticleBeforeBusiness("O Studio Bella pode devolver o sinal", BUSINESS)).toBe(true);
    expect(hasArticleBeforeBusiness("o sinal fica com o Studio Bella", BUSINESS)).toBe(true);
    expect(hasArticleBeforeBusiness("fica com Studio Bella", BUSINESS)).toBe(false);
    expect(hasArticleBeforeBusiness("Studio Bella pode devolver o sinal", BUSINESS)).toBe(false);
  });

  it("não copia a frase do cliente no componente e mantém o botão do dono", () => {
    const editor = readFileSync(new URL("../../components/policy/policy-editor.tsx", import.meta.url), "utf8");
    const form = readFileSync(new URL("../../components/dashboard/forms.tsx", import.meta.url), "utf8");
    expect(editor).not.toContain("confirma no painel");
    expect(editor).not.toContain("devolve pelo AgendaPix");
    expect(form).not.toContain("confirma no painel");
    expect(editor).toContain("Devolver pelo AgendaPix");
    expect(`${editor}\n${form}`).not.toMatch(/[`'"]O \$\{|com o \$\{/);
  });
});
