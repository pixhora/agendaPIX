import { LOGO_UPLOAD_FIELD, LOGO_UPLOAD_MAX_BYTES, logoUploadResponseSchema } from "@/lib/contracts";
import { profileErrorCopy } from "./api-copy";

export const LOGO_MAX_BYTES = LOGO_UPLOAD_MAX_BYTES;

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function logoSizeLabel(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Client pre-check. The server still checks magic bytes. */
export function logoRejection(file: { type: string; size: number; name?: string }): string | null {
  const type = file.type.toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  const extensionOk = /\.(png|jpe?g|webp)$/.test(name);
  const gif = type === "image/gif" || name.endsWith(".gif");
  const typeOk = !gif && (ACCEPTED_TYPES.has(type) || (type === "" && extensionOk));
  if (!typeOk) return "Formato não aceito. Envie PNG, JPEG ou WebP.";
  if (file.size > LOGO_MAX_BYTES) return `A imagem tem ${logoSizeLabel(file.size)} MB. O limite é 2 MB.`;
  return null;
}

/** Lado maior de referência: o servidor já reduz para 512 px, então 1024 px deixa a imagem nítida na tela. */
export const LOGO_SHRINK_MAX_EDGE_PX = 1024;

/** Tamanho final da imagem reduzida, mantendo a proporção e sem ampliar. */
export function logoShrinkSize(width: number, height: number, maxEdge = LOGO_SHRINK_MAX_EDGE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Foto de celular passa de 2 MB com facilidade e era recusada antes de chegar ao servidor.
 * Reduz no navegador (WebP) quando precisa; se não conseguir ler a imagem, devolve o arquivo original
 * para a validação normal mostrar a mensagem.
 */
export async function shrinkLogoIfNeeded(file: File): Promise<File> {
  if (file.size <= LOGO_MAX_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const size = logoShrinkSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // Safari nem sempre codifica WebP: o navegador devolve PNG. Nesse caso o arquivo rotulado como WebP
    // quebra na prévia, então só usamos o resultado quando o formato veio mesmo como WebP.
    if (!blob || blob.type !== "image/webp" || blob.size === 0) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export type LogoUploadResult = { ok: true; url: string } | { ok: false; message: string; cancelled?: boolean };

export function uploadLogoFile(
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void; endpoint?: string },
): Promise<LogoUploadResult> {
  const rejection = logoRejection(file);
  if (rejection) return Promise.resolve({ ok: false, message: rejection });
  const endpoint = options.endpoint;
  if (!endpoint) return Promise.resolve({ ok: false, message: profileErrorCopy("blob_unavailable") });
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append(LOGO_UPLOAD_FIELD, file);
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    const finish = (result: LogoUploadResult) => resolve(result);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = logoUploadResponseSchema.safeParse(JSON.parse(xhr.responseText));
          if (parsed.success) {
            finish({ ok: true, url: parsed.data.logoUrl });
            return;
          }
        } catch {
          finish({ ok: false, message: "Não deu para enviar a imagem. Tente de novo." });
          return;
        }
      }
      if (xhr.status === 400) {
        finish({ ok: false, message: profileErrorCopy("logo_invalid") });
        return;
      }
      if (xhr.status === 413) {
        finish({ ok: false, message: `A imagem tem ${logoSizeLabel(file.size)} MB. O limite é 2 MB.` });
        return;
      }
      if (xhr.status === 429) {
        finish({ ok: false, message: profileErrorCopy("rate_limited") });
        return;
      }
      if (xhr.status === 503) {
        finish({ ok: false, message: profileErrorCopy("blob_unavailable") });
        return;
      }
      finish({ ok: false, message: profileErrorCopy("internal_error") });
    };
    xhr.onerror = () => finish({ ok: false, message: "Não deu para enviar a imagem. Tente de novo." });
    xhr.onabort = () => finish({ ok: false, message: "", cancelled: true });
    if (options.signal.aborted) {
      finish({ ok: false, message: "", cancelled: true });
      return;
    }
    options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
