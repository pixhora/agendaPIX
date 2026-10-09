/** A vitrine fica fora de produção. O hub de `/preview` também, no layout. */
export function isMotionPreviewOpen(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
