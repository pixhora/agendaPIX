import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customerPreviewText, hasArticleBeforeBusiness, policyPreviewCopy } from "../../lib/dashboard/policy-preview";
import { depositPolicyPresets } from "../../lib/policy/schema";
import { ownerPreview, policyDetails, policySummary } from "../../lib/policy/text";

const BUSINESS = "Studio Bella";

describe("prévia da política no painel", () => {
  it("mostra o texto do cliente, e deixa a prévia do dono só no aviso", () => {
    for (const policy of Object.values(depositPolicyPresets)) {
      const copy = policyPreviewCopy(policy, BUSINESS, 2000);
      const customer = customerPreviewText(copy.summary, copy.details);
      expect(copy.summary).toBe(policySummary(policy, { depositCents: 2000, businessName: BUSINESS }));
      expect(copy.details).toEqual(policyDetails(policy, { businessName: BUSINESS, contactWhatsapp: null, timezone: "America/Sao_Paulo" }));
      expect(copy.owner).toBe(ownerPreview(policy, { depositCents: 2000 }));
      expect(customer).not.toContain("painel");
      expect(customer).not.toContain("Devolver pelo AgendaPix");
      expect(hasArticleBeforeBusiness(customer, BUSINESS)).toBe(false);
    }
    const padrao = policyPreviewCopy(depositPolicyPresets.padrao, BUSINESS, 2000);
    expect(padrao.summary).toContain("Studio Bella pode devolver o sinal");
    expect(customerPreviewText(padrao.summary, padrao.details)).toContain("fica com Studio Bella");
    expect(padrao.owner).toContain("você");
    expect(padrao.owner).not.toContain(BUSINESS);
  });

  it("reconhece artigo grudado no nome", () => {
    expect(hasArticleBeforeBusiness("O Studio Bella pode devolver o sinal", BUSINESS)).toBe(true);
    expect(hasArticleBeforeBusiness("o sinal fica com o Studio Bella", BUSINESS)).toBe(true);
    expect(hasArticleBeforeBusiness("fica com Studio Bella", BUSINESS)).toBe(false);
    expect(hasArticleBeforeBusiness("Studio Bella pode devolver o sinal", BUSINESS)).toBe(false);
  });

  it("não mostra policy.text nem a prévia do dono como texto do cliente", () => {
    const editor = readFileSync(new URL("../../components/policy/policy-editor.tsx", import.meta.url), "utf8");
    const form = readFileSync(new URL("../../components/dashboard/forms.tsx", import.meta.url), "utf8");
    expect(editor).not.toContain("policy.text");
    expect(editor).not.toContain("confirma no painel");
    expect(form).not.toContain("confirma no painel");
    expect(editor).toContain("Para você.");
    expect(editor).toContain("Devolver pelo AgendaPix");
    expect(`${editor}\n${form}`).not.toMatch(/[`'"]O \$\{|com o \$\{/);
  });
});
