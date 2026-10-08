/** A vitrine fica fora de produção. O hub de preview não tem trava própria. */
export function isMotionPreviewOpen(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
