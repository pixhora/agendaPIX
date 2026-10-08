"use client";

/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import "@/app/motion.css";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { COPY_ERROR, COPY_RESET_MS, copyValue } from "@/components/motion/motion-runtime";

export type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

type CopyState = "idle" | "copied" | "error";

/** Traço no mesmo peso dos ícones do app. Fica no arquivo para a ilha não puxar o runtime do lucide. */

function StrokeIcon({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-show={show ? "true" : "false"}>
      {children}
    </svg>
  );
}

/** Copia um código e avisa na própria região, sem toast. */
export function CopyButton({ value, label = "Copiar código", copiedLabel = "Copiado", className }: CopyButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resetRef = useRef<number | null>(null);
  const errorId = useId();
  const [state, setState] = useState<CopyState>("idle");
  const [announcement, setAnnouncement] = useState("");
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const copied = state === "copied";
  const exposeFallback = state === "error" || fallbackOpen;

  useEffect(() => () => {
    if (resetRef.current !== null) window.clearTimeout(resetRef.current);
  }, []);

  async function onCopy() {
    const input = inputRef.current;
    const result = await copyValue(value, {
      writeText: navigator.clipboard?.writeText?.bind(navigator.clipboard),
      execCommand: (command) => document.execCommand(command),
      select: () => {
        flushSync(() => setFallbackOpen(true));
        const field = inputRef.current;
        if (!field) return;
        field.focus();
        field.select();
        field.setSelectionRange(0, value.length);
      },
    });

    if (result === "copied") {
      setFallbackOpen(false);
      setState("copied");
      setAnnouncement(copiedLabel);
      if (resetRef.current !== null) window.clearTimeout(resetRef.current);
      resetRef.current = window.setTimeout(() => {
        setState("idle");
        setAnnouncement("");
        resetRef.current = null;
      }, COPY_RESET_MS);
      return;
    }

    setState("error");
    setAnnouncement("");
    input?.focus();
    input?.select();
  }

  return (
    <div className={`copy-control relative inline-flex max-w-full flex-col gap-2 rounded-field ${className ?? ""}`}>
      <button
        type="button"
        onClick={onCopy}
        aria-describedby={state === "error" ? errorId : undefined}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper"
      >
        <span className="copy-glyphs" aria-hidden="true">
          <StrokeIcon show={!copied}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5h10" />
          </StrokeIcon>
          <StrokeIcon show={copied}>
            <path d="M5 12.5 10 17.5 19 7" />
          </StrokeIcon>
        </span>
        {copied ? copiedLabel : label}
      </button>
      <span className="sr-only" aria-live="polite">{announcement}</span>
      <input
        ref={inputRef}
        readOnly
        value={value}
        tabIndex={state === "error" ? 0 : -1}
        aria-hidden={exposeFallback ? undefined : true}
        aria-label="Código para copiar"
        onFocus={(event) => event.currentTarget.select()}
        className={state === "error"
          ? "min-h-12 w-full rounded-field border border-line-strong bg-surface px-3 text-base text-ink"
          : "sr-only"}
      />
      {state === "error" ? <p id={errorId} role="alert" className="text-sm text-danger">{COPY_ERROR}</p> : null}
    </div>
  );
}
