import {
  SLOT_LINK_ERROR_CODES,
  slotLinkErrorBodySchema,
  slotLinkOpenResponseSchema,
  type SlotLinkOpenResponse,
  type SlotLinkStatus,
} from "@/lib/contracts/slot-link";

export const LINK_IN_PROGRESS = "link_in_progress";

export type SlotLinkFailureCode =
  | "link_expired"
  | "link_used"
  | "link_cancelled"
  | "link_invalid"
  | "slot_unavailable"
  | "mp_not_connected"
  | "link_in_progress"
  | "invalid_input"
  | "offline"
  | "unknown";

export type CustomerScreen =
  | { kind: "form"; link: SlotLinkOpenResponse }
  | { kind: "expired"; businessName: string | null; whatsapp: string | null; publicPath: string }
  | { kind: "taken"; publicPath: string }
  | { kind: "used"; publicPath: string }
  | { kind: "unavailable"; publicPath: string }
  | { kind: "offline"; publicPath: string }
  | { kind: "mp"; whatsapp: string | null; publicPath: string }
  | { kind: "in_progress"; publicPath: string }
  | { kind: "error"; publicPath: string };

const SLOT_LINK_CODES: readonly string[] = SLOT_LINK_ERROR_CODES;

export function readSlotLinkErrorCode(body: unknown): string | null {
  const parsed = slotLinkErrorBodySchema.safeParse(body);
  if (parsed.success) return parsed.data.error.code;
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = (body as { error?: { code?: unknown } }).error;
  if (typeof error?.code === "string" && SLOT_LINK_CODES.includes(error.code)) return error.code;
  return null;
}

export function slotStartsInPast(startsAt: string, now: Date) {
  const time = new Date(startsAt).getTime();
  return Number.isFinite(time) && time <= now.getTime();
}

function storeOf(link: SlotLinkOpenResponse) {
  return {
    businessName: link.business.name,
    whatsapp: link.business.contactWhatsapp,
    publicPath: link.business.publicPath,
  };
}

function linkTtlPassed(expiresAt: string, now: Date) {
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time <= now.getTime();
}

/**
 * `paid` no GET é o mesmo estado de link pago (link_used), sem botão de pagar.
 * Horário de atendimento que já passou continua expirado.
 * Com chave de pagamento salva, o expiresAt do link não esconde o formulário:
 * o POST retoma o Pix. A tela de expirado, nesse caminho, só aparece se o
 * backend responder `link_expired`.
 */
export function screenFromStatus(
  link: SlotLinkOpenResponse,
  now: Date,
  options?: { resumePay?: boolean },
): CustomerScreen {
  const store = storeOf(link);
  if (link.status === "paid") return { kind: "used", publicPath: store.publicPath };
  if (link.status === "cancelled") return { kind: "unavailable", publicPath: store.publicPath };
  if (slotStartsInPast(link.startsAt, now)) return { kind: "expired", ...store };
  if (link.status === "taken") return { kind: "taken", publicPath: store.publicPath };
  if (!options?.resumePay && (link.status === "expired" || linkTtlPassed(link.expiresAt, now))) {
    return { kind: "expired", ...store };
  }
  return { kind: "form", link };
}

export function screenFromFailure(
  code: SlotLinkFailureCode,
  context: { publicPath: string; businessName?: string | null; whatsapp?: string | null; startsAt?: string | null; now: Date },
): CustomerScreen {
  const past = context.startsAt ? slotStartsInPast(context.startsAt, context.now) : false;
  if (code === "link_used") return { kind: "used", publicPath: context.publicPath };
  if (code === "link_cancelled" || code === "link_invalid") return { kind: "unavailable", publicPath: context.publicPath };
  if (code === "mp_not_connected") {
    return { kind: "mp", whatsapp: context.whatsapp ?? null, publicPath: context.publicPath };
  }
  if (code === "link_in_progress") return { kind: "in_progress", publicPath: context.publicPath };
  if (code === "invalid_input") return { kind: "error", publicPath: context.publicPath };
  if (code === "offline") return { kind: "offline", publicPath: context.publicPath };
  if (code === "link_expired" || (code === "slot_unavailable" && past)) {
    return {
      kind: "expired",
      businessName: context.businessName ?? null,
      whatsapp: context.whatsapp ?? null,
      publicPath: context.publicPath,
    };
  }
  if (code === "slot_unavailable") return { kind: "taken", publicPath: context.publicPath };
  return { kind: "unavailable", publicPath: context.publicPath };
}

export function parseOpenLink(body: unknown) {
  return slotLinkOpenResponseSchema.parse(body);
}

export function failureCode(status: number, body: unknown): SlotLinkFailureCode {
  const code = readSlotLinkErrorCode(body);
  if (code === "link_expired" || status === 410) return "link_expired";
  if (code === "link_used" || code === "link_cancelled" || code === "link_invalid" || code === "slot_unavailable" || code === "mp_not_connected" || code === "link_in_progress" || code === "invalid_input") {
    return code;
  }
  if (status === 404) return "link_invalid";
  return "unknown";
}

export function shouldClearPayKey(screen: CustomerScreen | { kind: "confirmed" }) {
  return screen.kind === "expired" || screen.kind === "used" || screen.kind === "confirmed";
}

export function statusIsTerminal(status: SlotLinkStatus) {
  return status === "paid" || status === "expired" || status === "cancelled" || status === "taken";
}
