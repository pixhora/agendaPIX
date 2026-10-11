import { describe, expect, it } from "vitest";
import {
  SLOT_LINK_ERROR_CODES,
  SLOT_LINK_PREVIEW_ID_PATTERN,
  SLOT_LINK_TOKEN_PATTERN,
  SLOT_LINK_TTL_DEFAULT_MINUTES,
  slotLinkCreateRequestSchema,
  slotLinkCreatedResponseSchema,
  slotLinkErrorBodySchema,
  slotLinkErrorCodeSchema,
  slotLinkListResponseSchema,
  slotLinkOpenResponseSchema,
  slotLinkPayRequestSchema,
  slotLinkPreviewResponseSchema,
} from "../../lib/contracts";
import { apiErrorBodySchema } from "../../lib/contracts/errors";
import { slotLinkExpiresAt } from "../../lib/bookings/slot-link";
import { createSlotLinkPreviewId, createSlotLinkToken, isSlotLinkToken, redactSlotLinkToken, slotLinkTokenHash } from "../../lib/bookings/slot-link-token";

const service = { id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corte", durationMinutes: 30, priceCents: 8000, depositCents: 4000 };
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

describe("contrato do link de horário", () => {
  it("aceita serviço, data e hora e recusa campo extra ou horário sem dois dígitos", () => {
    expect(slotLinkCreateRequestSchema.parse({ serviceId: service.id, date: "2030-01-01", time: "11:30" })).toMatchObject({ time: "11:30" });
    expect(slotLinkCreateRequestSchema.safeParse({ serviceId: service.id, date: "2030-01-01", time: "11:30", name: "Ana" }).success).toBe(false);
    expect(slotLinkCreateRequestSchema.safeParse({ serviceId: service.id, date: "2030-01-01", time: "9:30" }).success).toBe(false);
    expect(slotLinkCreateRequestSchema.parse({ serviceId: service.id, date: "2030-01-01", time: "11:30", customerLabel: "  Ana  " }).customerLabel).toBe("Ana");
  });

  it("descreve a resposta do dono, a lista e o erro compartilhado", () => {
    const token = "A".repeat(43);
    const created = slotLinkCreatedResponseSchema.parse({ ...owner, token, path: `/api/public/salao-da-ana/slot-links/${token}` });
    expect(created.path.includes("#")).toBe(false);
    expect(created.path).toContain(`/slot-links/${token}`);
    expect(slotLinkListResponseSchema.parse({ links: [owner], nextCursor: null }).links).toHaveLength(1);
    expect(slotLinkErrorCodeSchema.options).toEqual([...SLOT_LINK_ERROR_CODES]);
    const body = slotLinkErrorBodySchema.parse({ error: { code: "link_invalid", message: "Este link não está mais disponível." } });
    expect(apiErrorBodySchema.parse(body).error.code).toBe("link_invalid");
    expect(SLOT_LINK_TTL_DEFAULT_MINUTES).toBe(1440);
  });

  it("o aberto traz horário e política, e a prévia distingue horário de capa genérica", () => {
    const opened = slotLinkOpenResponseSchema.parse({
      business: { name: "Salao", slug: "salao-da-ana", logoUrl: null, contactWhatsapp: null, publicPath: "/salao-da-ana" },
      service,
      startsAt: owner.startsAt,
      depositCents: 4000,
      remainingCents: 4000,
      policy: { text: "O sinal segue a política da loja.", hash: "a".repeat(64) },
      expiresAt: owner.expiresAt,
      status: "taken",
      requiresPayerCpf: false,
      bookingsPaused: false,
    });
    expect(opened.bookingsPaused).toBe(false);
    expect(slotLinkOpenResponseSchema.safeParse({ ...opened, bookingsPaused: undefined }).success).toBe(false);
    expect(slotLinkErrorCodeSchema.safeParse("bookings_paused").success).toBe(true);
    expect(opened.status).toBe("taken");
    const slot = slotLinkPreviewResponseSchema.parse({
      kind: "slot", businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00",
    });
    expect(slot).toEqual({ kind: "slot", businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00" });
    expect(slotLinkPreviewResponseSchema.parse({ kind: "generic", businessName: "Salao", logoUrl: "https://cdn.example/logo.webp" })).toEqual({
      kind: "generic", businessName: "Salao", logoUrl: "https://cdn.example/logo.webp",
    });
    expect(slotLinkPreviewResponseSchema.safeParse({ kind: "generic", businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00" }).success).toBe(false);
    expect(slotLinkPreviewResponseSchema.safeParse({ kind: "slot", businessName: "Salao", logoUrl: null, serviceName: "Corte", date: "2030-01-01", time: "09:00", phone: "+5511999999999" }).success).toBe(false);
    expect(slotLinkErrorCodeSchema.safeParse("link_in_progress").success).toBe(true);
  });

  it("o pagamento pede nome e WhatsApp vazios de dado prévio e recusa CPF inválido", () => {
    expect(slotLinkPayRequestSchema.parse({
      customer: { name: "Ana", phone: "+5511999999999" },
      policyHash: "ab".repeat(32),
    }).customer.name).toBe("Ana");
    expect(slotLinkPayRequestSchema.safeParse({
      customer: { name: "Ana", phone: "+5511999999999", cpfCnpj: "11111111111" },
      policyHash: "ab".repeat(32),
    }).success).toBe(false);
  });
});

describe("token do link", () => {
  it("tem 32 bytes em base64url, só o hash seria gravado, e a prévia não deriva o token", () => {
    const token = createSlotLinkToken();
    const previewId = createSlotLinkPreviewId();
    expect(token).toMatch(SLOT_LINK_TOKEN_PATTERN);
    expect(isSlotLinkToken(token)).toBe(true);
    expect(isSlotLinkToken(`${token}#pago`)).toBe(false);
    expect(slotLinkTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(slotLinkTokenHash(token)).not.toContain(token);
    expect(previewId).toMatch(SLOT_LINK_PREVIEW_ID_PATTERN);
    expect(previewId).not.toBe(token);
    expect(token.includes(".")).toBe(false);
  });

  it("redige o token no path e não deixa o valor bruto na mensagem", () => {
    const token = createSlotLinkToken();
    const redacted = redactSlotLinkToken(`/api/public/salao/slot-links/${token}/pay`);
    expect(redacted).toBe("/api/public/salao/slot-links/[redacted]/pay");
    expect(redacted).not.toContain(token);
    expect(redactSlotLinkToken(token)).toBe("[redacted]");
  });

  it("não deixa o prazo passar do início do horário", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const soon = new Date("2026-10-10T18:00:00.000Z");
    const later = new Date("2030-01-01T12:00:00.000Z");
    expect(slotLinkExpiresAt(now, soon, 1440).toISOString()).toBe(soon.toISOString());
    expect(slotLinkExpiresAt(now, later, 1440).toISOString()).toBe(new Date(now.getTime() + 1440 * 60_000).toISOString());
    expect(slotLinkExpiresAt(now, soon, 15).getTime()).toBeLessThanOrEqual(soon.getTime());
  });
});
