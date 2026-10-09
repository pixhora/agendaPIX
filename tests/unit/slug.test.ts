import { describe, expect, it } from "vitest";
import { RESERVED_BUSINESS_SLUGS, isPublicSlug, normalizeSlug, slugFromRawEdit, slugify } from "../../lib/slug";

describe("normalizeSlug", () => {
  it("keeps a trailing hyphen while typing and drops it when final", () => {
    const typed = ["a", "n", "a", "-", "l", "a", "s", "h"];
    let raw = "";
    const during = typed.map((char) => {
      raw += char;
      return normalizeSlug(raw, { final: false });
    });
    expect(during).toEqual(["a", "an", "ana", "ana-", "ana-l", "ana-la", "ana-las", "ana-lash"]);
    expect(normalizeSlug("ana-", { final: false })).toBe("ana-");
    expect(normalizeSlug("ana-", { final: true })).toBe("ana");
  });

  it("matches the normalization table", () => {
    expect(normalizeSlug("José & Cia", { final: false })).toBe("jose-cia");
    expect(normalizeSlug("José & Cia", { final: true })).toBe("jose-cia");
    expect(normalizeSlug("  Studio   Bella  ", { final: false })).toBe("studio-bella-");
    expect(normalizeSlug("  Studio   Bella  ", { final: true })).toBe("studio-bella");
    expect(normalizeSlug("--barbearia--do--zé", { final: true })).toBe("barbearia-do-ze");
    expect(normalizeSlug("Ça Va Beauté!!", { final: true })).toBe("ca-va-beaute");
    expect(normalizeSlug("studio_bella.lash", { final: true })).toBe("studio-bella-lash");
    expect(normalizeSlug("💅 Unhas da Bia", { final: true })).toBe("unhas-da-bia");
    expect(normalizeSlug("ab", { final: true })).toBe("ab");
    expect(normalizeSlug("a".repeat(45), { final: true })).toHaveLength(40);
    const cut = normalizeSlug(`${"a".repeat(39)}-${"b".repeat(10)}`, { final: false });
    expect(cut).toHaveLength(40);
    expect(normalizeSlug(`${"a".repeat(39)}-${"b".repeat(10)}`, { final: true })).toBe("a".repeat(39));
  });

  it("places the caret at the end of the normalized prefix", () => {
    expect(slugFromRawEdit("ana-lash", 4)).toEqual({ value: "ana-lash", caret: 4 });
    expect(slugFromRawEdit("José & Cia", 4).caret).toBe(normalizeSlug("José", { final: false }).length);
    expect(slugFromRawEdit("ana-lash", 4).caret).toBe(normalizeSlug("ana-", { final: false }).length);
  });

  it("keeps slugify as the final form", () => {
    expect(slugify("Barbearia do João")).toBe("barbearia-do-joao");
    expect(isPublicSlug("ab")).toBe(false);
    expect(isPublicSlug("ana")).toBe(true);
  });

  it("reserves the extra public paths", () => {
    expect(RESERVED_BUSINESS_SLUGS).toEqual(expect.arrayContaining(["precos", "ajuda", "suporte", "blog"]));
  });
});
