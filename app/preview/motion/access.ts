/** A vitrine de movimento segue a mesma trava de `/preview`: fechada em produção, salvo `PREVIEW_ROUTES_ENABLED=true`. */
export function isMotionPreviewOpen(
  nodeEnv: string | undefined,
  previewFlag: string | undefined = process.env.PREVIEW_ROUTES_ENABLED,
): boolean {
  if (nodeEnv !== "production") return true;
  return previewFlag === "true";
}
