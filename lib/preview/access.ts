import { notFound } from "next/navigation";

/**
 * Rotas `/preview/*` ficam abertas fora de produção.
 * Em produção, só abrem com `PREVIEW_ROUTES_ENABLED=true`. Sem a flag, respondem 404.
 */
export function isPreviewRouteOpen(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  previewFlag: string | undefined = process.env.PREVIEW_ROUTES_ENABLED,
): boolean {
  if (nodeEnv !== "production") return true;
  return previewFlag === "true";
}

/** Chama `notFound()` quando a rota de preview não pode abrir. */
export function closePreviewInProduction(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  previewFlag: string | undefined = process.env.PREVIEW_ROUTES_ENABLED,
): void {
  if (!isPreviewRouteOpen(nodeEnv, previewFlag)) notFound();
}
