import { afterEach, describe, expect, it, vi } from "vitest";
import { availabilityDates, hydrateCatalog, serializeCatalog, type PublicCatalog } from "../../lib/bookings/public-catalog";
import { publicCatalogTag } from "../../lib/bookings/public-cache";

const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (load: () => Promise<unknown>) => load,
}));

const catalog: PublicCatalog = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Studio",
  slug: "studio",
  timezone: "America/Sao_Paulo",
  contactWhatsapp: null,
  logoUrl: "https://blob.fake.local/logos/studio.webp",
  trialEndsAt: new Date("2030-01-08T02:59:59.000Z"),
  ownerName: "Ana",
  subscription: { status: "trialing", currentPeriodEnd: new Date("2030-02-01T00:00:00.000Z"), provider: null },
  mp: {
    status: "connected",
    hasTokens: true,
    expiresAt: new Date("2030-03-01T00:00:00.000Z"),
    liveMode: true,
    consentVersion: "2026-10-09.v4",
    autoRefundAckAt: new Date("2026-10-09T12:00:00.000Z"),
  },
  services: [],
  hours: [],
};

describe("catálogo público", () => {
  afterEach(() => {
    delete process.env.NEXT_RUNTIME;
    revalidateTag.mockClear();
  });

  it("nomeia a tag pelo slug", () => {
    expect(publicCatalogTag("barbearia-demo")).toBe("public-catalog:barbearia-demo");
  });

  it("aceita os 7 dias a partir da data e inclui o dia principal", () => {
    expect(availabilityDates("2030-01-01", undefined)).toEqual(["2030-01-01"]);
    expect(availabilityDates("2030-01-01", "2030-01-01,2030-01-03,2030-01-01")).toEqual(["2030-01-01", "2030-01-03"]);
    expect(availabilityDates("2030-01-01", "2030-01-02,2030-01-07")).toEqual(["2030-01-01", "2030-01-02", "2030-01-07"]);
  });

  it("rejeita dia fora da janela, mês inválido e dia que não existe", () => {
    expect(() => availabilityDates("2030-01-03", "2030-01-01,2030-01-02")).toThrow(expect.objectContaining({ status: 400, code: "invalid_input" }));
    expect(() => availabilityDates("2030-01-01", "2030-01-08")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => availabilityDates("2030-01-01", "2030-01-01,2030-01-02,2030-01-03,2030-01-04,2030-01-05,2030-01-06,2030-01-07,2030-01-08")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => availabilityDates("2030-01-01", "amanha")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => availabilityDates("2030-01-01", "2030-13-01")).toThrow(expect.objectContaining({ status: 400, code: "invalid_input" }));
    expect(() => availabilityDates("2030-01-01", "2030-02-31")).toThrow(expect.objectContaining({ status: 400, code: "invalid_input" }));
  });

  it("reidrata as datas do catálogo serializado", () => {
    const hydrated = hydrateCatalog(serializeCatalog(catalog));
    expect(hydrated.logoUrl).toBe(catalog.logoUrl);
    expect(hydrated.trialEndsAt.toISOString()).toBe(catalog.trialEndsAt.toISOString());
    expect(hydrated.subscription?.currentPeriodEnd?.toISOString()).toBe("2030-02-01T00:00:00.000Z");
    expect(hydrated.mp?.expiresAt?.toISOString()).toBe("2030-03-01T00:00:00.000Z");
    expect(hydrated.mp?.autoRefundAckAt?.toISOString()).toBe("2026-10-09T12:00:00.000Z");
  });

  it("não invalida o cache fora do Next", async () => {
    const { invalidatePublicCatalog } = await import("../../lib/bookings/public-cache");
    await invalidatePublicCatalog("barbearia-demo");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("invalida a tag na hora dentro do Next", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { invalidatePublicCatalog } = await import("../../lib/bookings/public-cache");
    await invalidatePublicCatalog("barbearia-demo");
    expect(revalidateTag).toHaveBeenCalledWith("public-catalog:barbearia-demo", { expire: 0 });
  });
});
