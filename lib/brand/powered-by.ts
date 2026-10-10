/**
 * Rodapé "feito no AgendaPix" da página pública.
 * A campanha distingue a página. Não há utm_content nem outro rastreio.
 */
export const POWERED_BY_LEAD = "Agenda com sinal no Pix feita no AgendaPix.";

export const POWERED_BY_LINK_LABEL = "Crie a sua grátis";

export type PoweredBySurface = "public_page" | "booking_confirmed" | "payment";

export type PoweredByCampaign = "pagina_publica" | "reserva_confirmada";

/** `null` na tela de Pix: o rodapé não aparece para não distrair do pagamento. */
export function poweredByCampaign(surface: PoweredBySurface): PoweredByCampaign | null {
  if (surface === "payment") return null;
  if (surface === "booking_confirmed") return "reserva_confirmada";
  return "pagina_publica";
}

/** Landing (`/`) com a UTM da spec. Sem parâmetro extra. */
export function poweredByHref(campaign: PoweredByCampaign): string {
  return `/?utm_source=agendapix&utm_medium=rodape&utm_campaign=${campaign}`;
}
