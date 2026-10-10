"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FieldError } from "@/components/ui/field";
import { fieldShell } from "@/components/ui/input";
import { centsFromTypedField, formatCents, parsePastedMoney, MAX_MONEY_CENTS } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Mesma caixa de texto para o prefixo "R$" e para o valor.
 * 16px, Inter, peso normal: igual aos outros campos e ao placeholder "0,00".
 */
export const moneyFigureClass = "font-sans text-base font-normal leading-6 tabular-nums";

const moneyPlaceholderClass = "placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:leading-6 placeholder:text-muted";

const PASTE_ERROR = "Não entendemos esse valor. Digite só os números.";

function shake(element: HTMLElement | null) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 120 },
  );
}

export function MoneyReadout({ cents, label }: { cents: number | null; label: string }) {
  return (
    <div className="flex min-h-12 items-center gap-1 rounded-field border border-line-strong/60 bg-surface px-3.5" aria-label={label}>
      {cents == null ? (
        <span className={cn(moneyFigureClass, "text-muted")}>—</span>
      ) : (
        <>
          <span aria-hidden="true" className={cn(moneyFigureClass, "text-ink")}>R$</span>
          <span className={cn(moneyFigureClass, "text-ink")}>{formatCents(cents)}</span>
        </>
      )}
    </div>
  );
}

export function MoneyInput({
  id,
  label,
  labelSuffix,
  hideLabel = false,
  valueCents,
  onChangeCents,
  error,
  hint,
  readOnly = false,
  disabled = false,
}: {
  id: string;
  label: string;
  /** Extra words for the screen reader, such as "em reais". */
  labelSuffix?: string;
  hideLabel?: boolean;
  valueCents: number | null;
  onChangeCents: (cents: number | null) => void;
  error?: string | null;
  hint?: string;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pasteError, setPasteError] = useState(false);
  const skipChange = useRef(false);
  const shownError = error || (pasteError ? PASTE_ERROR : null);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = shownError ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const text = valueCents == null ? "" : formatCents(valueCents);
  const quiet = readOnly || disabled;
  const empty = valueCents == null;

  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element || readOnly || document.activeElement !== element) return;
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }, [text, readOnly]);

  function emit(cents: number | null) {
    setPasteError(false);
    onChangeCents(cents);
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={cn("text-sm font-semibold", hideLabel && "sr-only")}>
        {label}
        {labelSuffix ? <span className="sr-only"> {labelSuffix}</span> : null}
      </label>
      <div
        ref={boxRef}
        className={cn(fieldShell, "gap-1 px-3.5", readOnly && "border-line bg-subtle shadow-none")}
      >
        <span
          aria-hidden="true"
          data-money-prefix=""
          className={cn(moneyFigureClass, "shrink-0", quiet || empty ? "text-muted" : "text-ink")}
        >
          R$
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          readOnly={readOnly}
          disabled={disabled}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          placeholder="0,00"
          value={text}
          onFocus={() => {
            const element = inputRef.current;
            if (!element) return;
            const end = element.value.length;
            element.setSelectionRange(end, end);
          }}
          onPaste={(event) => {
            event.preventDefault();
            skipChange.current = true;
            const parsed = parsePastedMoney(event.clipboardData.getData("text"));
            if (parsed == null) {
              setPasteError(true);
              return;
            }
            if (parsed > MAX_MONEY_CENTS) {
              shake(boxRef.current);
              return;
            }
            emit(parsed === 0 ? null : parsed);
          }}
          onChange={(event) => {
            if (readOnly || disabled) return;
            if (skipChange.current) {
              skipChange.current = false;
              return;
            }
            const interpreted = centsFromTypedField(event.target.value);
            if (interpreted.overflow) {
              shake(boxRef.current);
              return;
            }
            emit(interpreted.cents);
          }}
          className={cn(
            moneyFigureClass,
            moneyPlaceholderClass,
            "min-w-0 flex-1 bg-transparent text-ink outline-none disabled:cursor-not-allowed disabled:text-muted",
            quiet && "text-muted",
          )}
        />
      </div>
      {hint ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      <FieldError id={errorId}>{shownError}</FieldError>
    </div>
  );
}
