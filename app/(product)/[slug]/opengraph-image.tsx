import { neutralShareImageAlt, renderNeutralShareImage, shareImageSize } from "@/lib/brand/share-image";

export const alt = neutralShareImageAlt;
export const size = shareImageSize;
export const contentType = "image/png";
export const runtime = "nodejs";

/** Imagem única para qualquer slug. O nome do negócio não entra aqui. */
export default function Image() {
  return renderNeutralShareImage();
}
