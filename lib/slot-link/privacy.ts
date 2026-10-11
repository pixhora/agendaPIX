import type { SecurityHeader } from "@/lib/security/headers";

/** A página do link não entra em cache, não manda referrer e não é indexável. */
export function slotLinkPageHeaders(): SecurityHeader[] {
  return [
    { key: "Cache-Control", value: "no-store" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ];
}

/**
 * O matcher do proxy ignora prefetch. Esta regra cobre `/:slug/h/:token`
 * mesmo quando o documento é pré-carregado.
 */
export function slotLinkPageHeaderRule() {
  return {
    source: "/:slug/h/:token",
    headers: slotLinkPageHeaders(),
  };
}
