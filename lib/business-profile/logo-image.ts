import sharp from "sharp";
import { LOGO_UPLOAD_MAX_BYTES, LOGO_UPLOAD_MAX_EDGE_PX } from "../contracts";
import { HttpError } from "../http";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function looksLikeMarkup(bytes: Uint8Array) {
  const head = Buffer.from(bytes.subarray(0, 256)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype") || head.startsWith("<html");
}

/** PNG, JPEG ou WebP pelos bytes iniciais. Extensão e Content-Type não entram. */
export function assertLogoBytes(bytes: Uint8Array) {
  if (bytes.byteLength > LOGO_UPLOAD_MAX_BYTES) {
    throw new HttpError(413, "logo_too_large", "A imagem passa de 2 MB. Envie um arquivo menor.");
  }
  if (bytes.byteLength === 0 || looksLikeMarkup(bytes) || !(startsWith(bytes, PNG) || startsWith(bytes, JPEG) || isWebp(bytes))) {
    throw new HttpError(400, "logo_invalid", "Envie uma imagem PNG, JPEG ou WebP.");
  }
}

/**
 * No máximo 512 px no lado maior. `rotate()` aplica a orientação e o WebP sai sem EXIF.
 * Sharp omite metadados por padrão: https://sharp.pixelplumbing.com/api-output
 */
export async function reencodeLogo(bytes: Uint8Array) {
  assertLogoBytes(bytes);
  try {
    return await sharp(bytes, { failOn: "error", animated: false, limitInputPixels: 20_000_000 })
      .rotate()
      .resize({ width: LOGO_UPLOAD_MAX_EDGE_PX, height: LOGO_UPLOAD_MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "logo_invalid", "Envie uma imagem PNG, JPEG ou WebP.");
  }
}
