import {
  slotLinkCreatedResponseSchema,
  slotLinkListResponseSchema,
  slotLinkOwnerSchema,
  type SlotLinkCreatedResponse,
  type SlotLinkOwner,
} from "@/lib/contracts/slot-link";

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
