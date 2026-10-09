import { renderShareImage, shareImageAlt, shareImageSize } from "@/lib/brand/share-image";

export const alt = shareImageAlt;
export const size = shareImageSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function Image() {
  return renderShareImage();
}
