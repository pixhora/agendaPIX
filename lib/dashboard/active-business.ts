/** Último negócio aberto no painel. A URL (?businessId=) manda; o cookie vale quando ela vem sem o parâmetro (refresh, logo, voltar). */
export const ACTIVE_BUSINESS_COOKIE = "agendapix.business";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function activeBusinessCookie(businessId: string): string {
  return `${ACTIVE_BUSINESS_COOKIE}=${encodeURIComponent(businessId)}; path=/dashboard; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** Só aceita um id que pertence ao dono; qualquer outro valor cai no primeiro negócio. */
export function resolveBusiness<T extends { id: string }>(businesses: readonly T[], requested: string | undefined, remembered: string | undefined): T | undefined {
  if (requested) return businesses.find((item) => item.id === requested);
  return businesses.find((item) => item.id === remembered) ?? businesses[0];
}
