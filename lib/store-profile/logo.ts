export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

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

export type LogoUploadResult = { ok: true; url: string } | { ok: false; message: string; cancelled?: boolean };

export function uploadLogoFile(
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void; endpoint?: string },
): Promise<LogoUploadResult> {
  const rejection = logoRejection(file);
  if (rejection) return Promise.resolve({ ok: false, message: rejection });
  const endpoint = options.endpoint ?? "/api/uploads/logo";
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    const finish = (result: LogoUploadResult) => resolve(result);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { url?: unknown };
          if (typeof body.url === "string" && body.url.length > 0) {
            finish({ ok: true, url: body.url });
            return;
          }
        } catch {
          finish({ ok: false, message: "Não deu para enviar a imagem. Tente de novo." });
          return;
        }
      }
      if (xhr.status === 415) {
        finish({ ok: false, message: "Formato não aceito. Envie PNG, JPEG ou WebP." });
        return;
      }
      if (xhr.status === 413) {
        finish({ ok: false, message: `A imagem tem ${logoSizeLabel(file.size)} MB. O limite é 2 MB.` });
        return;
      }
      finish({ ok: false, message: "Não deu para enviar a imagem. Tente de novo." });
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
