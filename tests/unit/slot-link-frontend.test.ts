import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSlotLinkToken, slotLinkTokenHash } from "../../lib/bookings/slot-link-token";
import { SLOT_LINK_IDEMPOTENCY_KEY_PATTERN } from "../../lib/contracts/slot-link";
import { failureCode, isReplacedLinkError, screenFromFailure, screenFromStatus, shouldClearPayKey, slotStartsInPast } from "../../lib/slot-link/customer-state";
import { SLOT_LINK_HOLD_WINDOW_MS, claimDeadline, clearPayKey, createIdempotencyKey, keptAccessToken, lockPayPayload, memorySlotLinkStores, payRequestBody, purgeExpiredSlotLinkStorage, readOrCreatePayKey, readPayResume, savePayAccess, SLOT_LINK_CLAIM_PREFIX, slotLinkSessionKey, slotLinkStorageKey } from "../../lib/slot-link/idempotency";
import { parseOwnerList } from "../../lib/slot-link/owner-link";
import { isSlotLinkPagePath } from "../../lib/slot-link/paths";
import { slotLinkPageHeaderRule, slotLinkPageHeaders } from "../../lib/slot-link/privacy";
import { PIX_RESUME_STORAGE_PREFIX, purgeExpiredBookingSessions } from "../../components/booking/pix-resume";
import { GENERIC_OG_FALLBACK, parseSlotLinkPreview, slotLinkOgCopy, slotLinkOgLines, UNAVAILABLE_OG_LINES, UNAVAILABLE_OG_TEXT } from "../../lib/slot-link/preview";
import { sendOnWhatsApp } from "../../lib/slot-link/share";
import { ownerSummary, reissueFailure, reissueFailureMessage, cancelFailure, slotLinkMessage, updatedLinkMessage, validityLine, REISSUE_EXPIRED, REISSUE_IN_PROGRESS, REISSUE_MP, REISSUE_PAID, REISSUE_TAKEN, CANCEL_EXPIRED, CANCEL_PAID, OWNER_NETWORK } from "../../lib/slot-link/copy";
import { readShareMetaCache, shareMetaCacheKey, writeShareMetaCache, SHARE_META_CACHE_MAX, SHARE_META_NEGATIVE_MAX, SHARE_META_NEGATIVE_TTL_MS, SHARE_META_TTL_MS } from "../../lib/slot-link/share-meta-cache";
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
  bookingsPaused: false,
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
    expect(UNAVAILABLE_OG_LINES).toEqual(["AgendaPix", UNAVAILABLE_OG_TEXT]);
    expect(UNAVAILABLE_OG_LINES.join(" ")).not.toMatch(/Salao|livre|R\$|telefone/);
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
    expect(screenFromStatus({ ...openBase, status: "pending" as const, bookingsPaused: true }, now)).toMatchObject({
      kind: "paused",
      whatsapp: "+5511999999999",
      publicPath: "/salao",
    });
    expect(screenFromStatus({ ...openBase, status: "paid" as const, bookingsPaused: true }, now).kind).toBe("used");
  });

  it("horário futuro ocupado não vira expirado, e link pago continua confirmado", () => {
    expect(screenFromStatus({ ...openBase, status: "taken" }, now).kind).toBe("taken");
    expect(screenFromStatus({ ...openBase, status: "paid" }, now).kind).toBe("used");
    expect(screenFromStatus({ ...openBase, status: "replaced" }, now)).toMatchObject({
      kind: "updated",
      businessName: "Salao",
      whatsapp: "+5511999999999",
    });
    expect(screenFromStatus({ ...openBase, status: "cancelled" }, now).kind).toBe("unavailable");
    expect(screenFromFailure("link_used", { publicPath: "/salao", now }).kind).toBe("used");
    expect(screenFromStatus({ ...openBase, status: "paid" }, now).kind).toBe("used");
    expect(screenFromFailure("link_in_progress", { publicPath: "/salao", now }).kind).toBe("in_progress");
    expect(screenFromFailure("idempotency_conflict", { publicPath: "/salao", now }).kind).toBe("conflict");
    expect(failureCode(409, { error: { code: "idempotency_conflict", message: "interno", customerPhone: "+5511911112222" } })).toBe("idempotency_conflict");
    expect(shouldClearPayKey({ kind: "conflict", publicPath: "/salao" })).toBe(false);
    expect(screenFromFailure("invalid_input", { publicPath: "/salao", now }).kind).toBe("error");
    expect(screenFromFailure("link_invalid", { publicPath: "/salao", now }).kind).toBe("unavailable");
    expect(screenFromFailure("link_cancelled", { publicPath: "/salao", now }).kind).toBe("unavailable");
    const updated = screenFromFailure("link_replaced", {
      publicPath: "/salao",
      businessName: "Salao",
      whatsapp: "+5511999999999",
      now,
    });
    expect(updated).toMatchObject({ kind: "updated", businessName: "Salao", whatsapp: "+5511999999999" });
    expect(updatedLinkMessage("Salao")).toBe("Este link foi atualizado. Peça o link novo para Salao.");
    expect(updatedLinkMessage("  ")).toBe("Este link foi atualizado. Peça o link novo para a loja.");
    expect(isReplacedLinkError({ error: { code: "link_replaced", message: "interno" } })).toBe(true);
    expect(isReplacedLinkError({ error: { code: "link_cancelled", message: "interno", reason: "replaced" } })).toBe(false);
    expect(isReplacedLinkError({ error: { code: "link_cancelled", message: "interno", details: { reason: "replaced" } } })).toBe(false);
    expect(isReplacedLinkError({ error: { code: "link_cancelled", message: "interno" } })).toBe(false);
    expect(failureCode(409, { error: { code: "link_replaced", message: "interno" } })).toBe("link_replaced");
    expect(failureCode(409, { error: { code: "link_cancelled", message: "interno", reason: "replaced" } })).toBe("link_cancelled");
    expect(failureCode(409, { error: { code: "link_cancelled", message: "interno", details: { reason: "replaced" } } })).toBe("link_cancelled");
    expect(failureCode(409, { error: { code: "link_cancelled", message: "interno" } })).toBe("link_cancelled");
  });

  it("o prazo do link não abre a tela de expirado; só o código link_expired", () => {
    const stale = { ...openBase, status: "expired" as const, expiresAt: "2030-01-01T11:00:00.000Z" };
    expect(screenFromStatus(stale, now).kind).toBe("form");
    expect(screenFromStatus({ ...stale, status: "pending" }, now).kind).toBe("form");
    expect(screenFromFailure("link_expired", { publicPath: "/salao", now }).kind).toBe("expired");
    const past = { ...openBase, startsAt: "2020-01-01T12:00:00.000Z", status: "pending" as const };
    expect(screenFromStatus(past, now).kind).toBe("expired");
    const retry = screenFromFailure("rate_limited", { publicPath: "/salao", whatsapp: "+5511999999999", now });
    expect(retry).toMatchObject({ kind: "retry", rateLimited: true, whatsapp: "+5511999999999" });
    expect(screenFromFailure("server", { publicPath: "/salao", now })).toMatchObject({ kind: "retry", rateLimited: false });
    expect(failureCode(403, { error: { code: "bookings_paused", message: "Este estabelecimento não está aceitando novos agendamentos no momento." } })).toBe("bookings_paused");
    expect(screenFromFailure("bookings_paused", { publicPath: "/salao", whatsapp: "+5511999999999", now })).toEqual({
      kind: "paused",
      whatsapp: "+5511999999999",
      publicPath: "/salao",
    });
    expect(failureCode(403, { error: { code: "unauthorized", message: "interno" } })).toBe("unknown");
    expect(failureCode(429, { error: { code: "rate_limited", message: "interno" } })).toBe("rate_limited");
    expect(failureCode(503, { error: { code: "internal_error", message: "interno" } })).toBe("server");
  });

  it("pago e expirado apagam a chave; pagamento em andamento não", () => {
    expect(shouldClearPayKey({ kind: "used", publicPath: "/salao" })).toBe(true);
    expect(shouldClearPayKey({ kind: "expired", businessName: null, whatsapp: null, publicPath: "/salao" })).toBe(true);
    expect(shouldClearPayKey({ kind: "confirmed" })).toBe(true);
    expect(shouldClearPayKey({ kind: "in_progress", publicPath: "/salao" })).toBe(false);
  });
});

describe("idempotência do pagamento", () => {
  const expiresAt = "2030-01-01T15:00:00.000Z";
  const now = Date.parse("2030-01-01T12:00:00.000Z");

  it("a mesma chave é reaproveitada e uma loja vazia gera outra", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const keyA = "11111111-1111-4111-8111-111111111111";
    const keyB = "22222222-2222-4222-8222-222222222222";
    expect(SLOT_LINK_IDEMPOTENCY_KEY_PATTERN.test(createIdempotencyKey())).toBe(true);
    const first = await readOrCreatePayKey(token, stores, expiresAt, () => keyA, now);
    const second = await readOrCreatePayKey(token, stores, expiresAt, () => keyB, now);
    expect(first?.record.idempotencyKey).toBe(keyA);
    expect(second?.record.idempotencyKey).toBe(keyA);
    expect(first?.storageKey).toBe(second?.storageKey);
    expect(first?.storageKey.includes(token)).toBe(false);
    expect(first?.record.expiresAt).toBe(expiresAt);
    const other = await readOrCreatePayKey(token, memorySlotLinkStores(), expiresAt, () => keyB, now);
    expect(other?.record.idempotencyKey).toBe(keyB);
    expect(other?.record.idempotencyKey).not.toBe(first?.record.idempotencyKey);
  });

  it("apaga a chave depois do pagamento", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    await readOrCreatePayKey(token, stores, expiresAt, () => "11111111-1111-4111-8111-111111111111", now);
    await clearPayKey(token, stores);
    const again = await readOrCreatePayKey(token, stores, expiresAt, () => "33333333-3333-4333-8333-333333333333", now);
    expect(again?.record.idempotencyKey).toBe("33333333-3333-4333-8333-333333333333");
    expect(again?.record.payload).toBeUndefined();
    const key = await slotLinkStorageKey(token);
    expect(JSON.stringify(stores.claim.snapshot).includes(token)).toBe(false);
    expect(key.startsWith(SLOT_LINK_CLAIM_PREFIX)).toBe(true);
  });

  it("o primeiro payload fica travado e a retomada reenvia esse corpo", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const key = "11111111-1111-4111-8111-111111111111";
    const first = {
      customer: { name: "Ana Souza", phone: "+5511987654321" },
      policyHash: "ab".repeat(32),
    };
    const locked = await lockPayPayload(token, stores, first, expiresAt, () => key, now);
    const again = await lockPayPayload(token, stores, {
      customer: { name: "Outra Pessoa", phone: "+5511987654000", cpfCnpj: "52998224725" },
      policyHash: "cd".repeat(32),
    }, expiresAt, () => "22222222-2222-4222-8222-222222222222", now);
    expect(again?.record.idempotencyKey).toBe(key);
    expect(again?.payload).toEqual(first);
    expect(again?.fresh).toBe(false);
    expect(payRequestBody(again!.payload)).toEqual(first);
    const saved = JSON.stringify(stores.claim.snapshot);
    expect(saved.includes(token)).toBe(false);
    expect(saved.includes("52998224725")).toBe(false);
    expect(saved.includes("accessToken")).toBe(false);
    const kept = await lockPayPayload(token, stores, {
      customer: { name: "", phone: "" },
      policyHash: "ab".repeat(32),
    }, "2020-01-01T00:00:00.000Z", () => "99999999-9999-4999-8999-999999999999", now);
    expect(kept?.payload).toEqual(first);
    expect(kept?.record.idempotencyKey).toBe(key);
    await clearPayKey(token, stores);
    expect(await readPayResume(token, stores, now)).toBeNull();
    expect(locked?.payload.customer.name).toBe("Ana Souza");
  });

  it("accessToken fica só na sessão e o claim local guarda a chave com prazo", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const key = "11111111-1111-4111-8111-111111111111";
    await lockPayPayload(token, stores, {
      customer: { name: "Ana Souza", phone: "+5511987654321", cpfCnpj: "52998224725" },
      policyHash: "ab".repeat(32),
    }, expiresAt, () => key, now);
    const hold = "2030-01-01T16:00:00.000Z";
    await savePayAccess(token, stores, {
      bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
      accessToken: "token-secreto",
      expiresAt: hold,
      serviceId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
    }, now);
    const claim = stores.claim.snapshot[await slotLinkStorageKey(token)] ?? "";
    const session = stores.session.snapshot[await slotLinkSessionKey(token)] ?? "";
    expect(claim).not.toContain("token-secreto");
    expect(claim).not.toContain("accessToken");
    expect(claim).not.toContain("52998224725");
    expect(JSON.parse(claim).expiresAt).toBe(hold);
    expect(session).toContain("token-secreto");
    expect(stores.claim.snapshot[await slotLinkSessionKey(token)]).toBeUndefined();
    const resume = await readPayResume(token, stores, now);
    expect(resume?.accessToken).toBe("token-secreto");
    expect(resume?.idempotencyKey).toBe(key);
  });

  it("mantém o accessToken do mesmo bookingId e troca quando o agendamento muda", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const bookingId = "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c";
    const otherId = "8d2d6c40-3e5f-4061-ac1d-2e3f4a5b6c7d";
    const serviceId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(keptAccessToken(null, { bookingId, accessToken: "novo" })).toBe("novo");
    expect(keptAccessToken({ bookingId, accessToken: "antigo" }, { bookingId, accessToken: "novo" })).toBe("antigo");
    expect(keptAccessToken({ bookingId, accessToken: "antigo" }, { bookingId: otherId, accessToken: "novo" })).toBe("novo");
    await lockPayPayload(token, stores, {
      customer: { name: "Ana Souza", phone: "+5511987654321" },
      policyHash: "ab".repeat(32),
    }, expiresAt, () => "11111111-1111-4111-8111-111111111111", now);
    await savePayAccess(token, stores, { bookingId, accessToken: "token-antigo", expiresAt, serviceId }, now);
    await savePayAccess(token, stores, { bookingId, accessToken: "token-novo", expiresAt, serviceId }, now);
    const same = await readPayResume(token, stores, now);
    expect(same?.accessToken).toBe("token-antigo");
    await savePayAccess(token, stores, { bookingId: otherId, accessToken: "token-outro", expiresAt, serviceId }, now);
    const changed = await readPayResume(token, stores, now);
    expect(changed?.bookingId).toBe(otherId);
    expect(changed?.accessToken).toBe("token-outro");
  });

  it("ao carregar, apaga chave, payload e token vencidos ou sem prazo", async () => {
    const token = createSlotLinkToken();
    const live = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const claimKey = await slotLinkStorageKey(token);
    const sessionKey = await slotLinkSessionKey(token);
    const legacy = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      payload: { customer: { name: "Ana Souza", phone: "+5511987654321", cpfCnpj: "52998224725" }, policyHash: "ab".repeat(32) },
      bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
      accessToken: "token-secreto",
      serviceId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
      expiresAt,
    };
    stores.claim.set(claimKey, JSON.stringify(legacy));
    stores.session.set(claimKey, JSON.stringify(legacy));
    const staleKey = await slotLinkStorageKey(`${token}stale`);
    stores.claim.set(staleKey, JSON.stringify({ ...legacy, expiresAt: "2020-01-01T00:00:00.000Z" }));
    stores.session.set(await slotLinkSessionKey(`${token}stale`), JSON.stringify({
      bookingId: legacy.bookingId,
      accessToken: "token-velho",
      serviceId: legacy.serviceId,
      expiresAt: "2020-01-01T00:00:00.000Z",
    }));
    const missingKey = await slotLinkStorageKey(`${token}missing`);
    stores.claim.set(missingKey, JSON.stringify({ idempotencyKey: legacy.idempotencyKey, payload: legacy.payload }));
    await lockPayPayload(live, stores, {
      customer: { name: "Bia", phone: "+5511987654000" },
      policyHash: "cd".repeat(32),
    }, expiresAt, () => "22222222-2222-4222-8222-222222222222", now);

    purgeExpiredSlotLinkStorage(stores, now);

    const claim = stores.claim.snapshot[claimKey] ?? "";
    expect(claim).not.toContain("token-secreto");
    expect(claim).not.toContain("52998224725");
    expect(claim).not.toContain(token);
    expect(JSON.parse(claim).payload.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
    expect(stores.session.snapshot[claimKey]).toBeUndefined();
    expect(stores.session.snapshot[sessionKey]).toContain("token-secreto");
    expect(stores.claim.snapshot[staleKey]).toBeUndefined();
    expect(stores.session.snapshot[await slotLinkSessionKey(`${token}stale`)]).toBeUndefined();
    expect(stores.claim.snapshot[missingKey]).toBeUndefined();
    expect(stores.claim.snapshot[await slotLinkStorageKey(live)]).toContain("Bia");

    const sessions = memorySlotLinkStores().session;
    sessions.set(`${PIX_RESUME_STORAGE_PREFIX}salao`, JSON.stringify({
      bookingId: legacy.bookingId,
      accessToken: "token-pix",
      expiresAt: "2020-01-01T00:00:00.000Z",
      serviceId: legacy.serviceId,
    }));
    sessions.set(`${PIX_RESUME_STORAGE_PREFIX}outro`, JSON.stringify({
      bookingId: legacy.bookingId,
      accessToken: "token-vivo",
      expiresAt: null,
      serviceId: legacy.serviceId,
    }));
    purgeExpiredBookingSessions(sessions, now);
    expect(sessions.snapshot[`${PIX_RESUME_STORAGE_PREFIX}salao`]).toBeUndefined();
    expect(sessions.snapshot[`${PIX_RESUME_STORAGE_PREFIX}outro`]).toContain("token-vivo");

    const split = memorySlotLinkStores();
    const sessionKeyName = `${PIX_RESUME_STORAGE_PREFIX}salao`;
    const staleSession = JSON.stringify({
      bookingId: legacy.bookingId,
      accessToken: "token-local",
      expiresAt: "2020-01-01T00:00:00.000Z",
      serviceId: legacy.serviceId,
    });
    split.claim.set(sessionKeyName, staleSession);
    split.session.set(sessionKeyName, staleSession);
    purgeExpiredBookingSessions(split.session, now);
    expect(split.session.snapshot[sessionKeyName]).toBeUndefined();
    expect(split.claim.snapshot[sessionKeyName]).toContain("token-local");
  });

  it("guarda o claim até o hold, mesmo depois do expiresAt do link", async () => {
    const token = createSlotLinkToken();
    const stores = memorySlotLinkStores();
    const linkExpires = new Date(now - 60_000).toISOString();
    const locked = await lockPayPayload(token, stores, {
      customer: { name: "Ana Souza", phone: "+5511987654321", cpfCnpj: "52998224725" },
      policyHash: "ab".repeat(32),
    }, linkExpires, () => "11111111-1111-4111-8111-111111111111", now);
    expect(locked?.record.expiresAt).toBe(claimDeadline(linkExpires));
    expect(Date.parse(locked?.record.expiresAt ?? "")).toBe(Date.parse(linkExpires) + SLOT_LINK_HOLD_WINDOW_MS);
    const claimKey = await slotLinkStorageKey(token);
    expect(JSON.parse(stores.claim.snapshot[claimKey] ?? "{}").payload.customer.cpfCnpj).toBeUndefined();
    purgeExpiredSlotLinkStorage(stores, now);
    expect(stores.claim.snapshot[claimKey]).toContain("Ana Souza");
    purgeExpiredSlotLinkStorage(stores, now + SLOT_LINK_HOLD_WINDOW_MS + 1000);
    expect(stores.claim.snapshot[claimKey]).toBeUndefined();
    const laterHold = new Date(Date.parse(expiresAt) + SLOT_LINK_HOLD_WINDOW_MS + 60_000).toISOString();
    expect(claimDeadline(expiresAt, laterHold)).toBe(laterHold);
  });
});

describe("cache da prévia compartilhada", () => {
  it("repete a leitura só depois do prazo e a chave é o hash, não o token", () => {
    const token = createSlotLinkToken();
    const cache = new Map<string, { at: number; value: { title: string } }>();
    const key = shareMetaCacheKey("salao", slotLinkTokenHash(token));
    const now = Date.parse("2030-01-01T12:00:00.000Z");
    expect(readShareMetaCache(cache, key, now)).toBeNull();
    writeShareMetaCache(cache, key, now, { title: "Salao" });
    expect(readShareMetaCache(cache, key, now + SHARE_META_TTL_MS - 1)?.title).toBe("Salao");
    expect(readShareMetaCache(cache, key, now + SHARE_META_TTL_MS)).toBeNull();
    expect(key).not.toContain(token);
    expect(key).toContain(slotLinkTokenHash(token));
  });

  it("guarda 'não achou' por poucos segundos e não expulsa a prévia válida", () => {
    const cache = new Map<string, { at: number; value: { title: string }; negative?: boolean }>();
    const now = Date.parse("2030-01-01T12:00:00.000Z");
    writeShareMetaCache(cache, "neg", now, { title: "Generico" }, { negative: true, negativeMax: 2 });
    expect(readShareMetaCache(cache, "neg", now + SHARE_META_NEGATIVE_TTL_MS - 1)?.title).toBe("Generico");
    expect(readShareMetaCache(cache, "neg", now + SHARE_META_NEGATIVE_TTL_MS)).toBeNull();
    writeShareMetaCache(cache, "a", now, { title: "a" }, { positiveMax: 2 });
    writeShareMetaCache(cache, "b", now, { title: "b" }, { positiveMax: 2 });
    expect(readShareMetaCache(cache, "a", now)?.title).toBe("a");
    writeShareMetaCache(cache, "c", now, { title: "c" }, { positiveMax: 2 });
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    writeShareMetaCache(cache, "n1", now, { title: "n1" }, { negative: true, negativeMax: 2 });
    writeShareMetaCache(cache, "n2", now, { title: "n2" }, { negative: true, negativeMax: 2 });
    writeShareMetaCache(cache, "n3", now, { title: "n3" }, { negative: true, negativeMax: 2 });
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("n1")).toBe(false);
    expect(cache.has("n3")).toBe(true);
    expect(SHARE_META_CACHE_MAX).toBeGreaterThan(8);
    expect(SHARE_META_NEGATIVE_MAX).toBeGreaterThan(8);
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

  it("aceita status replaced e traduz os erros de gerar de novo", () => {
    const parsed = parseOwnerList({ links: [{ ...owner, status: "replaced" }], nextCursor: null });
    expect(parsed.links[0]?.status).toBe("replaced");
    expect(reissueFailureMessage("link_in_progress", 409)).toBe(REISSUE_IN_PROGRESS);
    expect(reissueFailureMessage("slot_unavailable", 409)).toBe(REISSUE_TAKEN);
    expect(reissueFailureMessage("rate_limited", 429)).toBe(OWNER_NETWORK);
    expect(reissueFailureMessage(null, 500)).toBe(OWNER_NETWORK);
    expect(reissueFailureMessage("link_used", 409)).toBe(REISSUE_PAID);
    expect(reissueFailureMessage("link_expired", 410)).toBe(REISSUE_EXPIRED);
    expect(reissueFailureMessage("mp_not_connected", 409)).toBe(REISSUE_MP);
    expect(reissueFailureMessage("link_used", 409)).not.toBe(OWNER_NETWORK);
    expect(reissueFailure("mp_not_connected", 409)).toMatchObject({ final: true, connect: true });
    expect(reissueFailure("link_used", 409).final).toBe(true);
    expect(reissueFailure("rate_limited", 429).final).toBe(false);
    expect(cancelFailure("link_used", 409)).toMatchObject({ message: CANCEL_PAID, final: true });
    expect(cancelFailure("link_expired", 410)).toMatchObject({ message: CANCEL_EXPIRED, final: true });
    expect(cancelFailure("rate_limited", 429).final).toBe(false);
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
    expect(slotLinkPageHeaderRule()).toEqual({
      source: "/:slug/h/:token",
      headers: slotLinkPageHeaders(),
    });
    const config = readFileSync(path.join(__dirname, "../../next.config.ts"), "utf8");
    expect(config).toContain("slotLinkPageHeaderRule()");
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

  it("nenhum Link aponta para a página do token", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith(".tsx")) continue;
        const source = readFileSync(full, "utf8");
        const tags = source.match(/<Link\b[\s\S]*?>/g) ?? [];
        for (const tag of tags) {
          if (tag.includes("slotLinkPagePath") || tag.includes("/h/")) offenders.push(full);
        }
      }
    };
    walk(path.join(__dirname, "../../components"));
    walk(path.join(__dirname, "../../app"));
    expect(offenders).toEqual([]);
  });
});
