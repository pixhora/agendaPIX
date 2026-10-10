"use client";

import { useLayoutEffect, useRef } from "react";
import { CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { slugFromRawEdit, normalizeSlug } from "@/lib/slug";
import type { SlugUiStatus } from "@/lib/store-profile/slug-ui";
import { cn } from "@/lib/utils";

export function SlugField({
  id,
  prefix,
  value,
  onValueChange,
  onBlur,
  status,
  message,
  suggestions = [],
  onPickSuggestion,
  onRetry,
  disabled,
  error,
}: {
  id: string;
  prefix: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  status: SlugUiStatus;
  message?: string | null;
  suggestions?: string[];
  onPickSuggestion?: (slug: string) => void;
  onRetry?: () => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const statusId = `${id}-status`;
  const errorId = `${id}-error`;
  const shown = error || message;
  const danger = status === "taken" || status === "reserved" || status === "invalid" || Boolean(error);
  const success = status === "available" && !error;

  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element || document.activeElement !== element || caretRef.current == null) return;
    const position = Math.min(caretRef.current, value.length);
    element.setSelectionRange(position, position);
    caretRef.current = null;
  }, [value]);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Seu link</Label>
      <div
        className={cn(
          "flex min-h-12 flex-col overflow-hidden rounded-field border bg-surface focus-within:shadow-focus sm:flex-row sm:items-stretch",
          danger && "border-destructive",
          success && "border-pix",
          !danger && !success && "border-border",
        )}
      >
        {prefix ? (
          <span className="flex min-h-11 items-center border-b border-border bg-subtle px-3 text-sm text-muted-foreground sm:max-w-[45%] sm:border-r sm:border-b-0">
            <span className="truncate">{prefix}/</span>
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
          disabled={disabled}
          placeholder="studio-da-ana"
          aria-invalid={danger ? true : undefined}
          aria-describedby={shown ? `${message ? statusId : ""} ${error ? errorId : ""}`.trim() : undefined}
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
          className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted-foreground disabled:text-muted-foreground"
        />
      </div>
      {message ? (
        <p id={statusId} aria-live="polite" className={cn("flex items-start gap-2 text-sm", danger && "font-medium text-destructive", success && "font-medium text-pix", status === "error" && "text-destructive")}>
          {status === "checking" ? <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
          {success ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          {status === "taken" || status === "reserved" ? <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          {status === "invalid" || status === "error" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          <span>{message}</span>
        </p>
      ) : null}
      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {status === "error" && onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-ink underline underline-offset-4">
          Tentar de novo
        </button>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de link">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              onClick={() => onPickSuggestion?.(suggestion)}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
