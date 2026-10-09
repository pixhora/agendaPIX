import { notFound } from "next/navigation";

/** Rotas `/preview/*` só existem fora de produção. A demo pública é `/exemplo`. */
export function isPreviewRouteOpen(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

/** Chama `notFound()` quando a rota de preview não pode abrir. */
export function closePreviewInProduction(nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (!isPreviewRouteOpen(nodeEnv)) notFound();
}
