import { describe, expect, it, vi } from "vitest";
import { normalizeSlug } from "../../lib/slug";
import { classifySlug, suggestionCandidates } from "../../lib/slug-availability";
import {
  SlugAvailabilityClient,
  availableSlug,
  fetchSlugAvailability,
  slugAvailabilityPath,
} from "../../lib/onboarding/slug-availability";

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
  expect(classifySlug("precos")).toMatchObject({ valid: false, available: false, reason: "reserved" });
  expect(classifySlug("studio-bella")).toMatchObject({ valid: false, available: false, reason: "reserved" });
});

it("monta sugestões na ordem da spec, sem sufixo inventado", () => {
  expect(suggestionCandidates("studio-bella", { segment: "cilios", uf: "sp" }).slice(0, 3)).toEqual([
    "studio-bella-lash",
    "studiobella",
    "studio-bella-sp",
  ]);
  expect(suggestionCandidates("studio-bella", { segment: "salao" })[0]).toBe("studiobella");
});

describe("slug availability client", () => {
  it("builds the public query with optional segment and state", () => {
    expect(slugAvailabilityPath("ana")).toBe("/api/public/slugs/availability?slug=ana");
    expect(slugAvailabilityPath("ana", { segment: "cilios", uf: "SP" })).toBe(
      "/api/public/slugs/availability?slug=ana&segment=cilios&uf=sp",
    );
  });

  it("treats 404 as unverified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    const result = await fetchSlugAvailability("ana-lash", new AbortController().signal);
    expect(result).toEqual({ ok: false, kind: "unverified" });
    vi.unstubAllGlobals();
  });

  it("ignores an older response", async () => {
    let releaseFirst: (value: Awaited<ReturnType<typeof fetchSlugAvailability>>) => void = () => {};
    const fetchImpl = vi.fn((slug: string) => {
      if (slug === "one") return new Promise<Awaited<ReturnType<typeof fetchSlugAvailability>>>((resolve) => { releaseFirst = resolve; });
      return Promise.resolve({ ok: true as const, availability: availableSlug("two") });
    });
    const client = new SlugAvailabilityClient(() => 0, fetchImpl);
    const first = client.check("one");
    const second = client.check("two");
    releaseFirst({ ok: true, availability: availableSlug("one") });
    await expect(first).resolves.toEqual({ ignored: true });
    await expect(second).resolves.toMatchObject({ ignored: false, result: { ok: true } });
  });

  it("forgets a cached answer after 60 seconds", async () => {
    let now = 0;
    const client = new SlugAvailabilityClient(() => now, async () => ({ ok: true, availability: availableSlug("ana") }));
    await client.check("ana");
    now = 59_999;
    expect(client.peek("ana")?.normalized).toBe("ana");
    now = 60_000;
    expect(client.peek("ana")).toBeNull();
  });
});
