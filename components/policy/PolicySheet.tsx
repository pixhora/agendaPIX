"use client";

import React, { useEffect, useId, useRef } from "react";
import type { PolicyDetailLine } from "@/components/booking/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CircleCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolicySheetProps {
  open: boolean;
  businessName: string;
  serviceName: string;
  depositLabel: string;
  lines?: PolicyDetailLine[] | null;
  /** Texto único quando o servidor não mandou as linhas (`policySummary` ou `policy.text`). */
  text?: string | null;
  notice?: string | null;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter(
    (el) => !el.hasAttribute("disabled"),
  );
}

/** Folha "Política do sinal". Só mostra strings recebidas. */
export function PolicySheet({
  open,
  businessName,
  serviceName,
  depositLabel,
  lines,
  text,
  notice,
  onClose,
  returnFocus,
}: PolicySheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const title = panelRef.current?.querySelector<HTMLElement>("[data-policy-title]");
    title?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      returnFocus?.focus();
    };
  }, [open, returnFocus]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = focusable(panelRef.current);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const rows = lines?.filter((line) => line.title.trim() && line.body.trim()) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Fechar política do sinal" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="policy-sheet"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-[20px] bg-surface shadow-[var(--shadow-raised)] motion-safe:animate-step-in motion-reduce:animate-none sm:max-w-[480px] sm:rounded-card"
      >
        <button
          type="button"
          aria-label="Arrastar para fechar"
          className="flex min-h-11 w-full items-center justify-center sm:hidden"
          onTouchStart={(event) => {
            dragRef.current = { y: event.changedTouches[0]?.clientY ?? 0 };
          }}
          onTouchEnd={(event) => {
            const start = dragRef.current?.y;
            const end = event.changedTouches[0]?.clientY ?? start ?? 0;
            dragRef.current = null;
            if (start != null && end - start > 80) onClose();
          }}
        >
          <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line-strong" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:pt-5">
          <h2 id={titleId} data-policy-title tabIndex={-1} className="font-display text-xl font-extrabold tracking-tight text-ink outline-none">
            Política do sinal
          </h2>
          <p className="mt-1 text-sm text-muted">
            {businessName} · {serviceName} · Sinal {depositLabel}
          </p>
          {notice ? <p className="mt-4 rounded-card bg-warning-soft px-4 py-3 text-sm font-medium text-ink">{notice}</p> : null}
          {rows.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {rows.map((line) => {
                const warn = line.tone === "warn";
                return (
                  <li key={`${line.title}-${line.body}`} className="flex gap-3">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", warn ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                      <Icon icon={warn ? Clock : CircleCheck} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink">{line.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{line.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : text?.trim() ? (
            <p className="mt-5 text-sm leading-relaxed text-ink">{text.trim()}</p>
          ) : null}
        </div>
        <div className="border-t border-line p-4">
          <Button type="button" size="lg" className="w-full" onClick={onClose}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
