/**
 * The settings notice promises the previous link keeps working.
 * That is true only after a 308 from the old slug. Nothing in the app router
 * does that yet (no `308` on a public slug). Keep this false until it lands.
 */
export const OLD_SLUG_REDIRECT_READY = false;
