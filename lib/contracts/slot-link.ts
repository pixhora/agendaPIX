import { z } from "zod";
import { cpfDigits, isValidCpf } from "../validation/cpf";
import { apiErrorDetailsSchema } from "./errors";

/**
 * Link de um horário só.
 *
 * O token opaco (32 bytes, base64url, 43 caracteres) vai no PATH, nunca no fragmento.
 * Só o sha256 fica no banco. `previewId` é outro aleatório público e não deriva o token.
 *
 * Prazo: `SLOT_LINK_TTL_MINUTES` (padrão 1440, faixa 15–10080). O `expiresAt` gravado
 * nunca passa de `startsAt`. Gerar o link não cria reserva.
 */

export const SLOT_LINK_TOKEN_BYTES = 32;
/** base64url sem padding de 32 bytes. */
export const SLOT_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const SLOT_LINK_PREVIEW_ID_BYTES = 16;
/** base64url sem padding de 16 bytes. Não é o token. */
export const SLOT_LINK_PREVIEW_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const SLOT_LINK_TTL_ENV = "SLOT_LINK_TTL_MINUTES";
export const SLOT_LINK_TTL_DEFAULT_MINUTES = 1440;
export const SLOT_LINK_TTL_MIN_MINUTES = 15;
export const SLOT_LINK_TTL_MAX_MINUTES = 7 * 24 * 60;

export const SLOT_LINK_CUSTOMER_LABEL_MAX = 80;

export const SLOT_LINKS_PATH = "/api/businesses/[businessId]/slot-links";
export const SLOT_LINK_CANCEL_PATH = "/api/businesses/[businessId]/slot-links/[linkId]/cancel";
export const SLOT_LINK_OPEN_PATH = "/api/public/[slug]/slot-links/[token]";
export const SLOT_LINK_PAY_PATH = "/api/public/[slug]/slot-links/[token]/pay";
export const SLOT_LINK_PREVIEW_PATH = "/api/public/slot-link-previews/[previewId]";

export const slotLinkStatusSchema = z.enum(["pending", "paid", "expired", "taken", "cancelled"]);
export type SlotLinkStatus = z.infer<typeof slotLinkStatusSchema>;

/**
 * Códigos deste fluxo, mais os de validação, limite e sessão que as mesmas rotas devolvem.
 * Token desconhecido, malformado ou de outro negócio: sempre `link_invalid` (404).
 */
export const SLOT_LINK_ERROR_CODES = [
  "link_expired",
  "link_used",
  "link_cancelled",
  "link_invalid",
  "slot_unavailable",
  "mp_not_connected",
  "invalid_input",
  "rate_limited",
  "unauthorized",
  "business_unavailable",
  "origin_not_allowed",
  "body_too_large",
] as const;

export const slotLinkErrorCodeSchema = z.enum(SLOT_LINK_ERROR_CODES);
export type SlotLinkErrorCode = z.infer<typeof slotLinkErrorCodeSchema>;

export const slotLinkErrorBodySchema = z.object({
  error: z.object({
    code: slotLinkErrorCodeSchema,
    message: z.string().min(1),
    details: apiErrorDetailsSchema.optional(),
  }).strict(),
}).strict();

export type SlotLinkErrorBody = z.infer<typeof slotLinkErrorBodySchema>;

const money = z.number().int().nonnegative();

export const slotLinkServiceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  priceCents: money,
  depositCents: money,
}).strict();

export type SlotLinkService = z.infer<typeof slotLinkServiceSchema>;

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const slotLinkCreateRequestSchema = z.object({
  serviceId: z.uuid(),
  date: z.iso.date(),
  time: localTime,
  /** Só o dono vê. Não preenche o nome da cliente no link. */
  customerLabel: z.string().trim().min(1).max(SLOT_LINK_CUSTOMER_LABEL_MAX).optional(),
}).strict();

export type SlotLinkCreateRequest = z.infer<typeof slotLinkCreateRequestSchema>;

export const slotLinkListQuerySchema = z.object({
  date: z.iso.date(),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
}).strict();

export type SlotLinkListQuery = z.infer<typeof slotLinkListQuerySchema>;

export const slotLinkOwnerSchema = z.object({
  id: z.uuid(),
  service: slotLinkServiceSchema,
  startsAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  status: slotLinkStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  previewId: z.string().regex(SLOT_LINK_PREVIEW_ID_PATTERN),
  customerLabel: z.string().min(1).max(SLOT_LINK_CUSTOMER_LABEL_MAX).nullable(),
}).strict();

export type SlotLinkOwner = z.infer<typeof slotLinkOwnerSchema>;

export const slotLinkCreatedResponseSchema = slotLinkOwnerSchema.extend({
  token: z.string().regex(SLOT_LINK_TOKEN_PATTERN),
  /** PATH público. O token não vai no fragmento. */
  path: z.string().regex(/^\/api\/public\/[a-z0-9]+(?:-[a-z0-9]+)*\/slot-links\/[A-Za-z0-9_-]{43}$/),
}).strict();

export type SlotLinkCreatedResponse = z.infer<typeof slotLinkCreatedResponseSchema>;

export const slotLinkListResponseSchema = z.object({
  links: z.array(slotLinkOwnerSchema),
  nextCursor: z.string().min(1).nullable(),
}).strict();

export type SlotLinkListResponse = z.infer<typeof slotLinkListResponseSchema>;

export const slotLinkOpenResponseSchema = z.object({
  business: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    logoUrl: z.string().nullable(),
    contactWhatsapp: z.string().nullable(),
    publicPath: z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict(),
  service: slotLinkServiceSchema,
  startsAt: z.iso.datetime({ offset: true }),
  depositCents: money,
  remainingCents: money,
  policy: z.object({
    text: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
  status: slotLinkStatusSchema,
  requiresPayerCpf: z.boolean(),
}).strict();

export type SlotLinkOpenResponse = z.infer<typeof slotLinkOpenResponseSchema>;

export const slotLinkPayRequestSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    cpfCnpj: z.string().trim().min(11).max(18).transform(cpfDigits).refine(isValidCpf, "CPF inválido.").optional(),
  }).strict(),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type SlotLinkPayRequest = z.infer<typeof slotLinkPayRequestSchema>;

export const slotLinkPayResponseSchema = z.object({
  bookingId: z.uuid(),
  status: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  accessToken: z.string().min(1),
  payment: z.object({
    id: z.uuid(),
    provider: z.string().min(1),
    externalId: z.string().nullable(),
    amountCents: money,
    status: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
    qrCodeDataUrl: z.string().nullable(),
    copyPaste: z.string().nullable(),
  }).strict().nullable(),
  policy: z.object({
    text: z.string(),
    snapshot: z.unknown().nullable(),
    refundDeadlineAt: z.iso.datetime({ offset: true }).nullable(),
    rescheduleDeadlineAt: z.iso.datetime({ offset: true }).nullable(),
    refundWindowClosedAtBooking: z.boolean(),
  }).strict().nullable(),
}).strict();

export type SlotLinkPayResponse = z.infer<typeof slotLinkPayResponseSchema>;

/** Prévia OG. Sem disponibilidade, sem sinal, sem dado da cliente. */
export const slotLinkPreviewResponseSchema = z.object({
  businessName: z.string().min(1),
  serviceName: z.string().min(1),
  date: z.iso.date(),
  time: localTime,
}).strict();

export type SlotLinkPreviewResponse = z.infer<typeof slotLinkPreviewResponseSchema>;
