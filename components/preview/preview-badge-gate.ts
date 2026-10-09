/**
 * Páginas de exemplo só existem fora de produção.
 * Na Vercel, preview e production têm NODE_ENV=production, então as duas ficam fechadas.
 */
export function isDevExampleOpen(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

/** O selo só existe em desenvolvimento, e só o layout de `/preview` o importa. */
export function isPreviewBadgeEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return isDevExampleOpen(nodeEnv);
}
