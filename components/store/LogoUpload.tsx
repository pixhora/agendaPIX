"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { logoRejection, uploadLogoFile } from "@/lib/store-profile/logo";
import { cn } from "@/lib/utils";

export function LogoUpload({
  url,
  onChangeUrl,
  disabled,
}: {
  url: string | null;
  onChangeUrl: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<File | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busy = progress != null;
  const shown = localPreview || url;
  const errorId = "store-logo-error";

  function openPicker() {
    inputRef.current?.click();
  }

  async function send(file: File) {
    const rejection = logoRejection(file);
    if (rejection) {
      setCanRetry(false);
      setError(rejection);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fileRef.current = file;
    setCanRetry(true);
    setError(null);
    setConfirmRemove(false);
    setLocalPreview(URL.createObjectURL(file));
    setProgress(0);
    const result = await uploadLogoFile(file, { signal: controller.signal, onProgress: setProgress });
    if (controller.signal.aborted || result.ok === false && result.cancelled) {
      setProgress(null);
      return;
    }
    setProgress(null);
    if (!result.ok) {
      setError(result.message);
      setLocalPreview(null);
      return;
    }
    onChangeUrl(result.url);
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          aria-describedby={error ? errorId : "store-logo-help"}
          onClick={openPicker}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void send(file);
          }}
          className={cn(
            "relative grid size-24 place-items-center overflow-hidden rounded-full border border-border bg-subtle text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            busy && "opacity-60",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local ou URL já enviada
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid place-items-center gap-1 px-2 text-center text-xs font-semibold">
              <ImageIcon aria-hidden="true" className="size-5" />
              Adicionar logo
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void send(file);
            }}
          />
        </button>
        <div className="grid gap-1">
          {!shown && !busy ? <p id="store-logo-help" className="text-sm text-muted-foreground">PNG, JPEG ou WebP, até 2 MB.</p> : null}
          {busy ? (
            <div className="grid gap-1" aria-live="polite">
              <p className="text-sm font-medium">Enviando… {progress}%</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0} aria-label="Envio da logo" className="h-2 w-40 overflow-hidden rounded-full bg-subtle">
                <span className="block h-full bg-pix" style={{ width: `${progress ?? 0}%` }} />
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4"
                onClick={() => abortRef.current?.abort()}
              >
                Cancelar
              </button>
            </div>
          ) : null}
          {shown && !busy ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold" onClick={openPicker} disabled={disabled}>Trocar</button>
              {confirmRemove ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  Remover logo?
                  <button type="button" className="inline-flex min-h-11 items-center font-semibold text-destructive underline" onClick={() => { setConfirmRemove(false); setLocalPreview(null); onChangeUrl(null); }}>Sim</button>
                  <button type="button" className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => setConfirmRemove(false)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold" disabled={disabled} onClick={() => setConfirmRemove(true)}>Remover</button>
              )}
            </div>
          ) : null}
          {error && canRetry ? (
            <button type="button" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4" onClick={() => { const file = fileRef.current; if (file) void send(file); }}>
              Tentar de novo
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
