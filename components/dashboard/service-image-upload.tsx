"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { logoRejection, prepareLogoFile, uploadLogoFile } from "@/lib/store-profile/logo";
import { cn } from "@/lib/utils";

/** Foto do serviço. Usa o mesmo caminho de envio da logo: reduz no aparelho e o servidor confere os bytes. */
export function ServiceImageUpload({
  businessId,
  serviceId,
  url,
  onChangeUrl,
}: {
  businessId: string;
  serviceId: string;
  url: string | null;
  onChangeUrl: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress != null;
  const shown = localPreview || url;

  async function send(original: File) {
    const file = await prepareLogoFile(original);
    const rejection = logoRejection(file);
    if (rejection) {
      setError(rejection);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setProgress(0);
    const result = await uploadLogoFile(file, {
      signal: controller.signal,
      onProgress: setProgress,
      endpoint: `/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(serviceId)}/image`,
    });
    setProgress(null);
    if (controller.signal.aborted || (result.ok === false && result.cancelled)) {
      setLocalPreview(null);
      return;
    }
    if (!result.ok) {
      setError(result.message);
      setLocalPreview(null);
      return;
    }
    setLocalPreview(null);
    onChangeUrl(result.url);
  }

  return (
    <div className="grid gap-2 text-sm font-semibold">
      <span>Foto do serviço <span className="font-normal text-muted">(opcional)</span></span>
      <div className="flex min-w-0 items-center gap-4">
        <label
          className={cn(
            "relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-field border border-line-strong/60 bg-subtle text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
            busy && "opacity-60",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local ou URL já enviada
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid place-items-center gap-1 text-center text-xs font-semibold">
              <ImageIcon aria-hidden="true" className="size-5" />
              Adicionar
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label="Foto do serviço"
            disabled={busy}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void send(file);
            }}
          />
        </label>
        <div className="grid min-w-0 gap-1 font-normal">
          {busy ? <p className="text-sm text-muted" aria-live="polite">Enviando… {progress}%</p> : null}
          {!busy && shown ? (
            <button type="button" className="inline-flex min-h-11 items-center self-start font-semibold underline underline-offset-4" onClick={() => inputRef.current?.click()}>
              Trocar foto
            </button>
          ) : null}
          {!busy && !shown ? <p className="text-sm text-muted">Foto do celular ou imagem comum. Se for grande, reduzimos sozinhos.</p> : null}
          {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
