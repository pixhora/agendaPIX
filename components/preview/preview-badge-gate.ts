/** O selo só existe em desenvolvimento, e só o layout de `/preview` o importa. */
export function isPreviewBadgeEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}
