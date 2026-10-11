export type MpStorePlatform = "android" | "ios" | "other";

/** App "Mercado Pago: cuenta digital" na App Store (id confirmado na busca pública). */
export const MP_APP_STORE_URL = "https://apps.apple.com/app/id925436649";
/** Busca na Play Store até confirmarmos o pacote do app. */
export const MP_PLAY_STORE_SEARCH_URL = "https://play.google.com/store/search?q=Mercado%20Pago&c=apps";

/** Android ou iPhone pelo user agent. iPadOS 13+ se identifica como Mac: contamos como iOS quando há toque. */
export function mpStorePlatform(userAgent: string, touchPoints = 0): MpStorePlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && touchPoints > 1)) return "ios";
  return "other";
}

export function mpStoreLink(platform: MpStorePlatform): { url: string; label: string } | null {
  if (platform === "android") return { url: MP_PLAY_STORE_SEARCH_URL, label: "Abrir na Google Play" };
  if (platform === "ios") return { url: MP_APP_STORE_URL, label: "Abrir na App Store" };
  return null;
}
