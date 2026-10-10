import { describe, expect, it } from "vitest";
import { createSlotLinkToken } from "../../lib/bookings/slot-link-token";
import { SLOT_LINK_IDEMPOTENCY_KEY_PATTERN } from "../../lib/contracts/slot-link";
import { screenFromFailure, screenFromStatus, shouldClearPayKey, slotStartsInPast } from "../../lib/slot-link/customer-state";
import { clearPayKey, createIdempotencyKey, memoryPayKeyStore, readOrCreatePayKey, slotLinkStorageKey } from "../../lib/slot-link/idempotency";
import { parseOwnerList } from "../../lib/slot-link/owner-link";
import { isSlotLinkPagePath } from "../../lib/slot-link/paths";
import { slotLinkPageHeaders } from "../../lib/slot-link/privacy";
import { GENERIC_OG_FALLBACK, parseSlotLinkPreview, slotLinkOgCopy, slotLinkOgLines } from "../../lib/slot-link/preview";
import { sendOnWhatsApp } from "../../lib/slot-link/share";
import { ownerSummary, slotLinkMessage, validityLine } from "../../lib/slot-link/copy";

const service = { id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corte", durationMinutes: 30, priceCents: 8000, depositCents: 4000 };
const openBase = {
  business: { name: "Salao", slug: "salao", logoUrl: null, contactWhatsapp: "+5511999999999", publicPath: "/salao" },
  service,
  startsAt: "2030-01-01T14:30:00.000Z",
  depositCents: 4000,
  remainingCents: 4000,
  policy: { text: "Política do sinal.", hash: "a".repeat(64) },
  expiresAt: "2030-01-01T14:00:00.000Z",
  requiresPayerCpf: false,
};

const owner = {
  id: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
  service,
  startsAt: "2030-01-01T12:00:00.000Z",
  expiresAt: "2030-01-01T11:00:00.000Z",
  status: "pending" as const,
  createdAt: "2026-10-10T12:00:00.000Z",
  previewId: "aaaaaaaaaaaaaaaaaaaaaa",
  customerLabel: null,
  cancellable: true,
};

describe("prévia do link", () => {
  it("kind slot monta título com horário e não fala se está livre", () => {
    const preview = parseSlotLinkPreview({
      kind: "slot",
      businessName: "Salao da Ana",
      logoUrl: "https://cdn.example/logo.png",
      serviceName: "Corte feminino",
      date: "2030-10-18",
      time: "11:30",
    });
    const copy = slotLinkOgCopy(preview);
    expect(copy.title).toBe("Corte feminino · 18/10 às 11:30 — Salao da Ana");
    expect(copy.description).toBe("Confirme pagando o sinal no Pix.");
    expect(copy.title + copy.description).not.toMatch(/livre|ocupado|pending|token/i);
    expect(slotLinkOgLines(preview)).toEqual(["Salao da Ana", "Corte feminino", "18/10 às 11:30", "Sinal no Pix"]);
  });

  it("kind generic e o fallback não trazem data, hora nem 404", () => {
    const preview = parseSlotLinkPreview({ kind: "generic", businessName: "Salao da Ana", logoUrl: null });
    const copy = slotLinkOgCopy(preview);
    expect(preview.kind).toBe("generic");
    expect(copy.title).toBe("Salao da Ana · Agende pelo AgendaPix");
    expect(copy.description).toBe("Agende pelo AgendaPix.");
    expect(slotLinkOgLines(preview).join(" ")).not.toMatch(/\d{2}\/\d{2}|às \d{2}:\d{2}|livre|ocupado/);
    expect(slotLinkOgLines(GENERIC_OG_FALLBACK)).toEqual(["AgendaPix", "Agende pelo AgendaPix"]);
  });

  it("sem kind não vira cartão de horário", () => {
    expect(() => parseSlotLinkPreview({ businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00" })).toThrow();
  });
});

describe("estados da cliente", () => {
  const now = new Date("2030-01-01T12:00:00.000Z");

  it("horário que já passou é expirado, mesmo com slot_unavailable", () => {
    const past = { ...openBase, startsAt: "2020-01-01T12:00:00.000Z", status: "taken" as const };
    expect(screenFromStatus(past, now).kind).toBe("expired");
    expect(slotStartsInPast(past.startsAt, now)).toBe(true);
    const failure = screenFromFailure("slot_unavailable", {
      publicPath: "/salao",
      businessName: "Salao",
      whatsapp: null,
      startsAt: past.startsAt,
      now,
    });
    expect(failure.kind).toBe("expired");
    expect(screenFromFailure("link_expired", { publicPath: "/salao", now }).kind).toBe("expired");
  });

  it("horário futuro ocupado não vira expirado, e link pago continua confirmado", () => {
    expect(screenFromStatus({ ...openBase, status: "taken" }, now).kind).toBe("taken");
    expect(screenFromStatus({ ...openBase, status: "paid" }, now).kind).toBe("used");
    expect(screenFromFailure("link_used", { publicPath: "/salao", now }).kind).toBe("used");
    expect(screenFromStatus({ ...openBase, status: "paid" }, now).kind).toBe("used");
    expect(screenFromFailure("link_in_progress", { publicPath: "/salao", now }).kind).toBe("in_progress");
    expect(screenFromFailure("invalid_input", { publicPath: "/salao", now }).kind).toBe("error");
    expect(screenFromFailure("link_invalid", { publicPath: "/salao", now }).kind).toBe("unavailable");
  });

  it("chave salva não bloqueia pelo expiresAt; sem chave, o prazo vencido expira", () => {
    const stale = { ...openBase, status: "expired" as const, expiresAt: "2030-01-01T11:00:00.000Z" };
    expect(screenFromStatus(stale, now, { resumePay: true }).kind).toBe("form");
    expect(screenFromStatus({ ...stale, status: "pending" }, now, { resumePay: true }).kind).toBe("form");
    expect(screenFromStatus(stale, now).kind).toBe("expired");
    expect(screenFromStatus({ ...stale, status: "pending" }, now).kind).toBe("expired");
    expect(screenFromFailure("link_expired", { publicPath: "/salao", now }).kind).toBe("expired");
    const past = { ...openBase, startsAt: "2020-01-01T12:00:00.000Z", status: "pending" as const };
    expect(screenFromStatus(past, now, { resumePay: true }).kind).toBe("expired");
  });

  it("pago e expirado apagam a chave; pagamento em andamento não", () => {
    expect(shouldClearPayKey({ kind: "used", publicPath: "/salao" })).toBe(true);
    expect(shouldClearPayKey({ kind: "expired", businessName: null, whatsapp: null, publicPath: "/salao" })).toBe(true);
    expect(shouldClearPayKey({ kind: "confirmed" })).toBe(true);
    expect(shouldClearPayKey({ kind: "in_progress", publicPath: "/salao" })).toBe(false);
  });
});

describe("idempotência do pagamento", () => {
  it("a mesma chave é reaproveitada e uma loja vazia gera outra", async () => {
    const token = createSlotLinkToken();
    const store = memoryPayKeyStore();
    const keyA = "11111111-1111-4111-8111-111111111111";
    const keyB = "22222222-2222-4222-8222-222222222222";
    expect(SLOT_LINK_IDEMPOTENCY_KEY_PATTERN.test(createIdempotencyKey())).toBe(true);
    const first = await readOrCreatePayKey(token, store, () => keyA);
    const second = await readOrCreatePayKey(token, store, () => keyB);
    expect(second.record.idempotencyKey).toBe(keyA);
    expect(first.storageKey).toBe(second.storageKey);
    expect(first.storageKey.includes(token)).toBe(false);
    const other = await readOrCreatePayKey(token, memoryPayKeyStore(), () => keyB);
    expect(other.record.idempotencyKey).toBe(keyB);
    expect(other.record.idempotencyKey).not.toBe(first.record.idempotencyKey);
  });

  it("apaga a chave depois do pagamento", async () => {
    const token = createSlotLinkToken();
    const store = memoryPayKeyStore();
    await readOrCreatePayKey(token, store, () => "11111111-1111-4111-8111-111111111111");
    await clearPayKey(token, store);
    const again = await readOrCreatePayKey(token, store, () => "33333333-3333-4333-8333-333333333333");
    expect(again.record.idempotencyKey).toBe("33333333-3333-4333-8333-333333333333");
    const key = await slotLinkStorageKey(token);
    expect(JSON.stringify(store.snapshot).includes(token)).toBe(false);
    expect(key.startsWith("agendapix.slot-link.pay.")).toBe(true);
  });
});

describe("lista do dono", () => {
  it("mostra cancelar quando cancellable é true, mesmo fora de pending", () => {
    const paid = { ...owner, status: "paid" as const, cancellable: true };
    const parsed = parseOwnerList({ links: [paid, { ...owner, cancellable: false }], nextCursor: null });
    expect(parsed.links[0]?.cancellable).toBe(true);
    expect(parsed.links[1]?.cancellable).toBe(false);
  });

  it("cancellable false esconde o cancelamento mesmo em pending", () => {
    const parsed = parseOwnerList({
      links: [owner, { ...owner, id: "8d2d6c40-3e5f-4061-8c1d-2e3f4a5b6c7d", cancellable: false }],
      nextCursor: null,
    });
    expect(parsed.links[0]?.cancellable).toBe(true);
    expect(parsed.links[1]?.cancellable).toBe(false);
    expect(() => parseOwnerList({ links: [{ ...owner, cancellable: undefined }], nextCursor: null })).toThrow();
  });
});

describe("textos e privacidade da página", () => {
  it("monta a mensagem, o resumo e a validade com o expiresAt", () => {
    expect(ownerSummary({ serviceName: "Corte feminino", date: "2030-10-18", time: "11:30", depositCents: 4000 })).toContain("Corte feminino ·");
    expect(ownerSummary({ serviceName: "Corte feminino", date: "2030-10-18", time: "11:30", depositCents: 4000 })).toContain("11:30");
    const named = slotLinkMessage({ customerLabel: "Ana", serviceName: "Corte", date: "2030-10-18", time: "11:30", depositCents: 4000, url: "https://exemplo.test/salao/h/token" });
    expect(named.startsWith("Oi, Ana!")).toBe(true);
    expect(slotLinkMessage({ serviceName: "Corte", date: "2030-10-18", time: "11:30", depositCents: 4000, url: "https://exemplo.test/x" }).startsWith("Oi!")).toBe(true);
    expect(validityLine("2030-10-18T14:30:00.000Z", "America/Sao_Paulo")).toMatch(/^Vale até \d{2}\/\d{2} às \d{2}:\d{2} ou até alguém ocupar o horário\.$/);
  });

  it("a página do link não é indexável e o WhatsApp móvel tenta compartilhar", async () => {
    const token = createSlotLinkToken();
    expect(isSlotLinkPagePath(`/salao/h/${token}`)).toBe(true);
    expect(isSlotLinkPagePath("/salao")).toBe(false);
    expect(isSlotLinkPagePath(`/api/public/salao/slot-links/${token}`)).toBe(false);
    const headers = Object.fromEntries(slotLinkPageHeaders().map((header) => [header.key, header.value]));
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    const shared: { text: string }[] = [];
    const opened: string[] = [];
    await expect(sendOnWhatsApp("Oi", {
      mobile: true,
      share: async (data) => { shared.push(data); },
      open: (url) => opened.push(url),
    })).resolves.toBe("shared");
    expect(shared).toEqual([{ text: "Oi" }]);
    expect(opened).toEqual([]);
    await sendOnWhatsApp("Oi", { mobile: false, share: async () => { throw new Error("não"); }, open: (url) => opened.push(url) });
    expect(opened[0]).toBe(`https://wa.me/?text=${encodeURIComponent("Oi")}`);
  });
});
