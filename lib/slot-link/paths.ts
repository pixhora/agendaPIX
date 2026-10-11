import { SLOT_LINK_PREVIEW_ID_PATTERN, SLOT_LINK_TOKEN_PATTERN } from "@/lib/contracts/slot-link";

const seg = encodeURIComponent;

/** Página da cliente. O token vai no path, nunca na query. */
export function slotLinkPagePath(slug: string, token: string) {
  return `/${seg(slug)}/h/${seg(token)}`;
}

/** Agenda pública. Sem token, sem UTM. */
export function publicAgendaPath(slug: string) {
  return `/${seg(slug)}`;
}

export function ownerSlotLinksUrl(businessId: string) {
  return `/api/businesses/${seg(businessId)}/slot-links`;
}

export function cancelSlotLinkUrl(businessId: string, linkId: string) {
  return `/api/businesses/${seg(businessId)}/slot-links/${seg(linkId)}/cancel`;
}

export function reissueSlotLinkUrl(businessId: string, linkId: string) {
  return `/api/businesses/${seg(businessId)}/slot-links/${seg(linkId)}/reissue`;
}

export function publicSlotLinkUrl(slug: string, token: string) {
  return `/api/public/${seg(slug)}/slot-links/${seg(token)}`;
}

export function paySlotLinkUrl(slug: string, token: string) {
  return `/api/public/${seg(slug)}/slot-links/${seg(token)}/pay`;
}

export function slotLinkPreviewUrl(previewId: string) {
  return `/api/public/slot-link-previews/${seg(previewId)}`;
}

/** Imagem de prévia. Só o previewId, nunca o token. */
export function slotLinkOgImagePath(previewId: string) {
  return `/og/slot-link/${seg(previewId)}`;
}

export function isSlotLinkPagePath(pathname: string) {
  const parts = pathname.split("/");
  if (parts.length !== 4 || parts[2] !== "h") return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1] ?? "")) return false;
  return SLOT_LINK_TOKEN_PATTERN.test(parts[3] ?? "");
}

export function isSlotLinkPreviewId(value: string) {
  return SLOT_LINK_PREVIEW_ID_PATTERN.test(value);
}
