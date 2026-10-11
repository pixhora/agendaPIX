import {
  slotLinkCreatedResponseSchema,
  slotLinkListResponseSchema,
  slotLinkOwnerSchema,
  type SlotLinkCreatedResponse,
  type SlotLinkOwner,
} from "@/lib/contracts/slot-link";
import { SLOT_LINK_STATUS_LABEL, clockInZone, isoDateInZone, slotLinkMessage } from "@/lib/slot-link/copy";
import { slotLinkPagePath } from "@/lib/slot-link/paths";

export type OwnerLink = SlotLinkOwner;
export type CreatedSlotLink = SlotLinkCreatedResponse;

/** Cancelar só aparece quando o contrato marca `cancellable`. */
export function parseOwnerList(body: unknown) {
  return slotLinkListResponseSchema.parse(body);
}

export function parseOwnerLink(body: unknown) {
  return slotLinkOwnerSchema.parse(body);
}

export function parseCreatedLink(body: unknown) {
  return slotLinkCreatedResponseSchema.parse(body);
}

export type SlotLinkReadyView = {
  url: string;
  message: string;
  expiresAt: string;
  statusLabel: string;
};

/** A tela de link pronto. O token só entra na URL e na mensagem, nunca na lista. */
export function slotLinkReadyView(created: CreatedSlotLink, slug: string, timezone: string, origin: string): SlotLinkReadyView {
  const url = `${origin}${slotLinkPagePath(slug, created.token)}`;
  const date = isoDateInZone(created.startsAt, timezone);
  return {
    url,
    message: slotLinkMessage({
      customerLabel: created.customerLabel,
      serviceName: created.service.name,
      date,
      time: clockInZone(created.startsAt, timezone),
      depositCents: created.service.depositCents,
      url,
    }),
    expiresAt: created.expiresAt,
    statusLabel: SLOT_LINK_STATUS_LABEL[created.status],
  };
}

/** O 201 do reissue é o link novo. A lista guarda só o que o dono já via, sem token. */
export function ownerFromCreated(created: CreatedSlotLink): OwnerLink {
  return {
    id: created.id,
    service: created.service,
    startsAt: created.startsAt,
    expiresAt: created.expiresAt,
    status: created.status,
    createdAt: created.createdAt,
    previewId: created.previewId,
    customerLabel: created.customerLabel,
    cancellable: created.cancellable,
  };
}
