import { expect, it } from "vitest";
import { normalizeSlug } from "../../lib/slug";
import { classifySlug, suggestionCandidates } from "../../lib/slug-availability";

it("normaliza acento, pontuação e hífen final quando o link está pronto", () => {
  expect(normalizeSlug("Studio Bella", { final: true })).toBe("studio-bella");
  expect(normalizeSlug("Açúcar & Café", { final: true })).toBe("acucar-cafe");
  expect(normalizeSlug("studio-", { final: false })).toBe("studio-");
  expect(normalizeSlug("studio-", { final: true })).toBe("studio");
});

it("classifica link curto, inválido e reservado sem consultar o banco", () => {
  expect(classifySlug("ab")).toMatchObject({ normalized: "ab", valid: false, reason: "too_short", available: false });
  expect(classifySlug("***")).toMatchObject({ normalized: "", valid: false, reason: "invalid" });
  expect(classifySlug("dashboard")).toMatchObject({ valid: false, available: false, reason: "reserved" });
  expect(classifySlug("studio-bella")).toMatchObject({ valid: true, available: true, reason: null });
});

it("monta sugestões na ordem da spec, sem sufixo inventado", () => {
  expect(suggestionCandidates("studio-bella", { segment: "cilios", uf: "sp" }).slice(0, 3)).toEqual([
    "studio-bella-lash",
    "studiobella",
    "studio-bella-sp",
  ]);
  expect(suggestionCandidates("studio-bella", { segment: "salao" })[0]).toBe("studiobella");
});
