import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSlotLinkToken, slotLinkTokenHash } from "../../lib/bookings/slot-link-token";
import { STORE_CARD_NEGATIVE_TTL_MS, STORE_CARD_TTL_MS, forgetStoreCard } from "../../lib/slot-link/store-card-cache";
import {
  SHARE_META_NO_IDENTITY,
  SHARE_META_PROBE_SCOPE,
  clearShareMetaCache,
  shareMetaBucketIdentity,
  shareMetaCacheRecord,
  slotLinkShareMeta,
  type SlotLinkShareMetaOptions,
} from "../../lib/slot-link/share-meta";

const slug = "salao";
const logo = "https://cdn.example.com/logo.png";
const limit = 3;

function ports() {
  const counts = new Map<string, number>();
  const seen: string[] = [];
  const selects: string[] = [];
  const known = new Map<string, string>();
  const probeExhausted: NonNullable<SlotLinkShareMetaOptions["probeExhausted"]> = vi.fn(async (scope, identity, max) => {
    seen.push(`${scope}:${identity}:${max}`);
    return (counts.get(identity) ?? 0) >= max;
  });
  const probeConsume: NonNullable<SlotLinkShareMetaOptions["probeConsume"]> = vi.fn(async (scope, identity) => {
    seen.push(`${scope}:${identity}`);
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  });
  const findToken: NonNullable<SlotLinkShareMetaOptions["findToken"]> = vi.fn(async (_store: string, tokenHash: string) => {
    selects.push(tokenHash);
    const previewId = known.get(tokenHash);
    return previewId ? { previewId } : null;
  });
  const readPreview: NonNullable<SlotLinkShareMetaOptions["readPreview"]> = vi.fn(async () => ({
    kind: "slot" as const,
    businessName: "Negócio de teste",
    logoUrl: logo,
    serviceName: "Corte",
    date: "2030-01-01",
    time: "09:00",
  }));
  const storeCard: NonNullable<SlotLinkShareMetaOptions["storeCard"]> = vi.fn(async () => ({
    businessName: "Negócio de teste",
    logoUrl: logo,
  }));
  const options = (identity: string | null): SlotLinkShareMetaOptions => ({
    identity,
    database: {} as SlotLinkShareMetaOptions["database"],
    limit,
    probeExhausted,
    probeConsume,
    findToken,
    readPreview,
    storeCard,
  });
  return { counts, seen, selects, known, probeConsume, findToken, storeCard, options };
}

function remember(known: Map<string, string>, token: string, previewId: string) {
  known.set(slotLinkTokenHash(token), previewId);
}

beforeEach(() => {
  clearShareMetaCache();
});

describe("generateMetadata da prévia", () => {
  it("50 acessos do mesmo token válido devolvem a prévia completa sem gastar o balde", async () => {
    const { known, options, findToken, probeConsume, selects } = ports();
    const token = createSlotLinkToken();
    remember(known, token, "previewvalido00000001");
    const metas = [];
    for (let index = 0; index < 55; index += 1) {
      metas.push(await slotLinkShareMeta(slug, token, 1_700_000_000_000, options("peer:whatsapp")));
    }
    for (const meta of metas) {
      expect(meta.title).toContain("Corte");
      expect(meta.title).toContain("Negócio de teste");
      expect(meta.image).toBe("/og/slot-link/previewvalido00000001");
    }
    expect(findToken).toHaveBeenCalledTimes(1);
    expect(probeConsume).not.toHaveBeenCalled();
    expect(selects).toHaveLength(1);
    expect(shareMetaCacheRecord(slug, token)?.negative).toBe(false);
  });

  it("tokens falsos estouram o balde e o seguinte não consulta o token", async () => {
    const { options, findToken, selects } = ports();
    const now = 1_700_000_000_000;
    const identity = "peer:scanner";
    for (let index = 0; index < limit; index += 1) {
      const fake = createSlotLinkToken();
      const before = selects.length;
      const meta = await slotLinkShareMeta(slug, fake, now, options(identity));
      expect(selects.length).toBe(before + 1);
      expect(meta.title).toBe("Negócio de teste · Agende pelo AgendaPix");
      expect(meta.title).not.toContain("Corte");
      expect(meta.image).toBe(logo);
      expect(shareMetaCacheRecord(slug, fake)?.negative).toBe(true);
      const again = selects.length;
      await slotLinkShareMeta(slug, fake, now, options(identity));
      expect(selects.length).toBe(again);
    }
    const blocked = createSlotLinkToken();
    const before = selects.length;
    const meta = await slotLinkShareMeta(slug, blocked, now, options(identity));
    expect(selects.length).toBe(before);
    expect(findToken).toHaveBeenCalledTimes(limit);
    expect(meta.title).toBe("AgendaPix · Agende pelo AgendaPix");
    expect(meta.image).toBeNull();
    expect(meta.title).not.toContain("Corte");
    expect(shareMetaCacheRecord(slug, blocked)).toBeNull();
  });

  it("hash válido não entra no cache negativo, nem quando o balde já estourou", async () => {
    const { known, options } = ports();
    const now = 1_700_000_000_000;
    const identity = "peer:mixed";
    const valid = createSlotLinkToken();
    remember(known, valid, "previewvalido00000002");
    await slotLinkShareMeta(slug, valid, now, options(identity));
    expect(shareMetaCacheRecord(slug, valid)?.negative).toBe(false);
    for (let index = 0; index < limit; index += 1) {
      await slotLinkShareMeta(slug, createSlotLinkToken(), now, options(identity));
    }
    expect(shareMetaCacheRecord(slug, valid)?.negative).toBe(false);
    const unseen = createSlotLinkToken();
    remember(known, unseen, "previewvalido00000003");
    const blocked = await slotLinkShareMeta(slug, unseen, now, options(identity));
    expect(blocked.title).not.toContain("Corte");
    expect(shareMetaCacheRecord(slug, unseen)).toBeNull();
    expect(shareMetaCacheRecord(slug, valid)?.negative).toBe(false);
  });

  it("tokens falsos de uma identidade não fecham o balde de outra", async () => {
    const { known, seen, options, selects } = ports();
    const now = 1_700_000_000_000;
    for (let index = 0; index < limit; index += 1) {
      await slotLinkShareMeta(slug, createSlotLinkToken(), now, options("peer:a"));
    }
    const pending = selects.length;
    const blocked = createSlotLinkToken();
    await slotLinkShareMeta(slug, blocked, now, options("peer:a"));
    expect(selects.length).toBe(pending);

    const valid = createSlotLinkToken();
    remember(known, valid, "previewvalido00000004");
    const other = await slotLinkShareMeta(slug, valid, now, options("peer:b"));
    expect(other.title).toContain("Corte");
    expect(other.image).toBe("/og/slot-link/previewvalido00000004");
    expect(shareMetaCacheRecord(slug, valid)?.negative).toBe(false);

    const anonymousFake = createSlotLinkToken();
    const beforeAnonymous = selects.length;
    await slotLinkShareMeta(slug, anonymousFake, now, options(null));
    expect(selects.length).toBe(beforeAnonymous + 1);
    expect(shareMetaBucketIdentity(null)).toBe(SHARE_META_NO_IDENTITY);
    expect(shareMetaBucketIdentity(null)).not.toBe("*global*");
    expect(seen.some((entry) => entry.includes("*global*"))).toBe(false);
    expect(seen.some((entry) => entry.startsWith(`${SHARE_META_PROBE_SCOPE}:${SHARE_META_NO_IDENTITY}:`))).toBe(true);
    expect(seen.some((entry) => entry.startsWith(`${SHARE_META_PROBE_SCOPE}:peer:b:`))).toBe(true);

    for (let index = 0; index < limit - 1; index += 1) {
      await slotLinkShareMeta(slug, createSlotLinkToken(), now, options(null));
    }
    const afterAnonymous = selects.length;
    await slotLinkShareMeta(slug, createSlotLinkToken(), now, options(null));
    expect(selects.length).toBe(afterAnonymous);

    const second = createSlotLinkToken();
    remember(known, second, "previewvalido00000005");
    const fresh = await slotLinkShareMeta(slug, second, now, options("peer:c"));
    expect(fresh.title).toContain("Corte");
    expect(shareMetaCacheRecord(slug, second)?.negative).toBe(false);
  });

  it("com o bucket estourado e slugs aleatórios não consulta businesses", async () => {
    const { counts, options, findToken, storeCard } = ports();
    const now = 1_700_000_000_000;
    counts.set("peer:flood", limit);
    const names = [slug, ...Array.from({ length: 12 }, (_, index) => `loja-${index}`)];
    for (const name of names) {
      for (let index = 0; index < 3; index += 1) {
        const meta = await slotLinkShareMeta(name, createSlotLinkToken(), now + index, options("peer:flood"));
        expect(meta.title).toBe("AgendaPix · Agende pelo AgendaPix");
        expect(meta.image).toBeNull();
      }
    }
    expect(storeCard).not.toHaveBeenCalled();
    expect(findToken).not.toHaveBeenCalled();
  });

  it("slugs aleatórios não repetem o SELECT e o mesmo slug consulta uma vez na janela", async () => {
    const { options } = ports();
    const now = 1_700_000_000_000;
    let selects = 0;
    const storeCard = vi.fn(async (name: string) => {
      selects += 1;
      if (name === slug) return { businessName: "Negócio de teste", logoUrl: logo, missing: false };
      return { businessName: "AgendaPix", logoUrl: null, missing: true };
    });
    const call = (name: string, at: number) => slotLinkShareMeta(name, createSlotLinkToken(), at, { ...options("peer:card"), storeCard, limit: 100 });
    const randomSlugs = Array.from({ length: 12 }, (_, index) => `loja-${index}`);
    for (const name of randomSlugs) {
      await call(name, now);
      await call(name, now + 1_000);
    }
    expect(selects).toBe(randomSlugs.length);
    const before = selects;
    for (let index = 0; index < 6; index += 1) await call(slug, now + index);
    expect(selects).toBe(before + 1);
    await call(slug, now + STORE_CARD_TTL_MS - 1);
    expect(selects).toBe(before + 1);
    await call(randomSlugs[0] ?? "loja-0", now + STORE_CARD_NEGATIVE_TTL_MS);
    expect(selects).toBe(before + 2);
    forgetStoreCard(slug);
    await call(slug, now);
    expect(selects).toBe(before + 3);
  });

  it("erro ao ler o balde cai no genérico e avisa sem token", async () => {
    const { options } = ports();
    const token = createSlotLinkToken();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const meta = await slotLinkShareMeta(slug, token, 1_700_000_000_000, {
      ...options("peer:warn"),
      probeExhausted: async () => {
        throw new Error(`db ${token}`);
      },
    });
    expect(meta.title).toBe("Negócio de teste · Agende pelo AgendaPix");
    expect(meta.title).not.toContain("Corte");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain(token);
    expect(String(warn.mock.calls[0]?.[0])).not.toMatch(/[a-f0-9]{64}/);
    warn.mockRestore();
  });
});
