/**
 * URLs das rotas públicas reais do app (`app/api/public/[slug]/*`), sempre same-origin.
 * Todo segmento ou parâmetro que vem do usuário (slug do link, ids, datas) é codificado
 * aqui para que nenhum valor consiga alterar o caminho ou a query da requisição.
 */
const seg = encodeURIComponent;

export function publicBookingPagePath(slug: string, bookingId?: string) {
  const path = `/${seg(slug)}`;
  return bookingId ? `${path}?${new URLSearchParams({ bookingId })}` : path;
}

export function publicServicesUrl(slug: string) {
  return `/api/public/${seg(slug)}/services`;
}

export function publicAvailabilityUrl(slug: string, serviceId: string, date: string, extraDates?: string[]) {
  const params = new URLSearchParams({ serviceId, date });
  if (extraDates && extraDates.length > 1) params.set("dates", extraDates.join(","));
  return `/api/public/${seg(slug)}/availability?${params}`;
}

export function publicBookingsUrl(slug: string) {
  return `/api/public/${seg(slug)}/bookings`;
}

export function publicBookingPaymentUrl(slug: string, bookingId: string) {
  return `/api/public/${seg(slug)}/bookings/${seg(bookingId)}/payment`;
}

export function devSimulatePixUrl() {
  return "/api/dev/simulate-pix";
}
