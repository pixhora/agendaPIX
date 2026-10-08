export const ONBOARDING_DRAFT_COOKIE = "onb_draft";
export const ONBOARDING_DRAFT_MAX_AGE_SECONDS = 604800;

export function onboardingDraftCookie(draftId: string) {
  return `${ONBOARDING_DRAFT_COOKIE}=${encodeURIComponent(draftId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONBOARDING_DRAFT_MAX_AGE_SECONDS}`;
}

export function readOnboardingDraftCookie(header: string | null) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0 || trimmed.slice(0, separator) !== ONBOARDING_DRAFT_COOKIE) continue;
    try { return decodeURIComponent(trimmed.slice(separator + 1)) || null; }
    catch { return null; }
  }
  return null;
}

/** Mostra a primeira letra do nome e o domínio. O restante do e-mail não volta na API. */
export function maskEmail(email: string) {
  const [local = "", domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
