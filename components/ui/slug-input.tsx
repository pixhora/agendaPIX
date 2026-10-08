"use client";

import { useLayoutEffect, useRef } from "react";
import { CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { normalizeSlug, slugFromRawEdit } from "@/lib/slug";
import { cn } from "@/lib/utils";

export type SlugVisualStatus = "idle" | "pending" | "checking" | "available" | "taken" | "reserved" | "short" | "invalid" | "error" | "offline";

export function SlugInput({
  id,
  host,
  value,
  onValueChange,
  onBlur,
  status,
  message,
  suggestions = [],
  onPickSuggestion,
  describedBy,
}: {
  id: string;
  host: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  status: SlugVisualStatus;
  message?: string | null;
  suggestions?: string[];
  onPickSuggestion?: (slug: string) => void;
  describedBy?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const statusId = `${id}-status`;
  const danger = status === "taken" || status === "reserved" || status === "short" || status === "invalid";
  const success = status === "available";
  const warning = status === "error" || status === "offline";

  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element || document.activeElement !== element || caretRef.current == null) return;
    const position = Math.min(caretRef.current, value.length);
    element.setSelectionRange(position, position);
    caretRef.current = null;
  }, [value]);

  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "onb-control-wrap flex min-h-[52px] items-stretch overflow-hidden rounded-field border bg-surface focus-within:shadow-focus",
          danger && "border-danger",
          success && "border-success",
          !danger && !success && "border-line-strong/60 focus-within:border-ring",
        )}
        data-slug-status={status}
      >
        {host ? (
          <span className="flex max-w-[45%] shrink-0 items-center border-r border-line bg-subtle px-3 text-sm text-muted">
            <span dir="rtl" className="truncate">
              <span dir="ltr">{host}/</span>
            </span>
          </span>
        ) : null}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={danger ? true : undefined}
          aria-describedby={[message ? statusId : null, describedBy].filter(Boolean).join(" ") || undefined}
          value={value}
          onChange={(event) => {
            const caretInRaw = event.target.selectionStart ?? event.target.value.length;
            const next = slugFromRawEdit(event.target.value, caretInRaw);
            caretRef.current = next.caret;
            onValueChange(next.value);
          }}
          onBlur={() => {
            const finalValue = normalizeSlug(value, { final: true });
            if (finalValue !== value) onValueChange(finalValue);
            onBlur?.();
          }}
          className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-ink outline-none"
        />
        <span className="flex items-center pr-3 text-muted" aria-hidden="true">
          {status === "checking" ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : null}
          {success ? <CircleCheck className="size-5 text-success" /> : null}
          {danger ? <CircleX className="size-5 text-danger" /> : null}
          {warning ? <CircleAlert className="size-5 text-warning" /> : null}
        </span>
      </div>
      {message ? (
        <p id={statusId} role="status" aria-live="polite" className={cn("flex items-start gap-2 text-sm", danger && "font-medium text-danger", success && "font-medium text-success", warning && "text-warning", !danger && !success && !warning && "text-muted")}>
          {danger || warning ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          <span>{message}</span>
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de link">
          {suggestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPickSuggestion?.(suggestion)}
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
