/** Active aliases redirect. A fourth change releases the oldest instead of deleting it. */
export const ACTIVE_ALIAS_CAP = 3;

/** After `released_at`, every other business is blocked for this long. Then the link is free. */
export const ALIAS_HOLD_MS = 90 * 24 * 60 * 60 * 1000;

/** Slug changes per owner. A pure TTL is not used: a freed link could be taken by someone else. */
export const SLUG_CHANGE_LIMIT = 3;

/** Every PATCH /profile, including a name-only save. */
export const PROFILE_PATCH_LIMIT = 30;

/**
 * Held while the alias still redirects, or for 90 days after it was released.
 * Exactly 90 days after `released_at` the link is free.
 */
export function aliasHoldActive(releasedAt: Date | null, now = new Date()): boolean {
  if (releasedAt == null) return true;
  return now.getTime() - releasedAt.getTime() < ALIAS_HOLD_MS;
}
