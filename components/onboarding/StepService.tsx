"use client";

import { useState, type ReactNode } from "react";
import { FieldError } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { DEPOSIT_NOW_LABEL, REMAINDER_LABEL } from "@/lib/copy/booking-summary";
import { formatCents, depositFromPercent } from "@/lib/money";
import { EMPTY_SERVICE_PREVIEW_HOLD, projectServicePreview } from "@/lib/onboarding/service-preview";
import { cn } from "@/lib/utils";
import { StepActions } from "./chrome";
import { StepHeader, stepBodyClass } from "./parts";
import type { DepositMode } from "./types";

const PRESETS = [
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 90, label: "1h30" },
] as const;

const PERCENTS = [20, 30, 50] as const;
const NO_DEPOSIT = "Sem sinal: a reserva confirma na hora, sem Pix.";
const DEPOSIT_HINT = "O cliente paga isso para garantir o horário. O resto ele paga no atendimento.";
const PRICE_HINT = "Digite só os números, os centavos entram sozinhos: 6590 vira R$ 65,90.";
const NAME_ERROR = "Dê um nome ao serviço.";
const PRICE_ERROR = "Informe o preço do serviço.";
const DURATION_ERROR = "Informe a duração em minutos, entre 5 e 720.";
const DEPOSIT_ERROR = "O sinal não pode ser maior que o preço.";

function durationLabel(minutes: number) {
  return PRESETS.find((item) => item.minutes === minutes)?.label ?? `${minutes} min`;
}

export function StepService({
  serviceName,
  durationMinutes,
  priceCents,
  depositCents,
  depositMode,
  onChangeServiceName,
  onChangeDuration,
  onChangePrice,
  onChangeDeposit,
  onChangeDepositMode,
  onBack,
  onNext,
  policy,
}: {
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  depositMode: DepositMode;
  onChangeServiceName: (value: string) => void;
  onChangeDuration: (value: number) => void;
  onChangePrice: (cents: number) => void;
  onChangeDeposit: (cents: number) => void;
  onChangeDepositMode: (mode: DepositMode) => void;
  onBack: () => void;
  onNext: () => void;
  /**
   * Ponto de extensão da política do sinal (FE-23, 03 §5, 06 §4.1).
   * Este passo não desenha essa seção. "Sem sinal" esconde o ponto.
   */
  policy?: ReactNode;
}) {
  const [customOpen, setCustomOpen] = useState(!PRESETS.some((item) => item.minutes === durationMinutes));
  const [attempted, setAttempted] = useState(false);
  const price = priceCents > 0 ? priceCents : null;
  const nameOk = serviceName.trim().length >= 1 && serviceName.trim().length <= 120;
  const durationOk = customOpen ? durationMinutes >= 5 && durationMinutes <= 720 && durationMinutes % 5 === 0 : PRESETS.some((item) => item.minutes === durationMinutes);
  const priceOk = priceCents >= 100;
  const noDeposit = depositMode === "none";
  const depositOk = noDeposit || depositCents <= priceCents;
  const showPolicy = !noDeposit && depositCents > 0 && policy != null;
  const canContinue = nameOk && durationOk && priceOk && depositOk;
  const priced = priceOk;
  const [previewHold, setPreviewHold] = useState(EMPTY_SERVICE_PREVIEW_HOLD);
  const preview = projectServicePreview(previewHold, {
    durationMinutes,
    customDuration: customOpen,
    priceCents,
    depositCents,
    depositMode,
  });
  if (
    preview.hold.durationMinutes !== previewHold.durationMinutes ||
    preview.hold.priceCents !== previewHold.priceCents ||
    preview.hold.depositCents !== previewHold.depositCents
  ) {
    setPreviewHold(preview.hold);
  }
  const shownDuration = preview.view.durationMinutes;
  const summaryNoDeposit = preview.view.noDeposit && preview.view.priceCents != null;

  function setMode(mode: DepositMode) {
    onChangeDepositMode(mode);
    if (mode === "none") {
      onChangeDeposit(0);
      return;
    }
    if (mode === "custom") {
      onChangeDeposit(depositCents > 0 ? depositCents : depositFromPercent(priceCents, 30));
      return;
    }
    onChangeDeposit(depositFromPercent(priceCents, Number(mode)));
  }

  function setPrice(cents: number | null) {
    const next = cents ?? 0;
    onChangePrice(next);
    if (depositMode === "none") {
      onChangeDeposit(0);
      return;
    }
    if (depositMode !== "custom") onChangeDeposit(depositFromPercent(next, Number(depositMode)));
  }

  function focusFirstProblem() {
    setAttempted(true);
    const order = ["service-name", customOpen ? "service-duration-custom" : "", "service-price", depositMode === "custom" ? "service-deposit" : ""];
    const invalid = [
      !nameOk,
      customOpen && !durationOk,
      !priceOk,
      depositMode === "custom" && !depositOk,
    ];
    const id = order[invalid.findIndex(Boolean)];
    if (id) document.getElementById(id)?.focus();
  }

  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) {
          focusFirstProblem();
          return;
        }
        onNext();
      }}
    >
      <div className={stepBodyClass}>
        <StepHeader title="Seu primeiro serviço" description="É o que o cliente vai ver na sua página. Depois você cadastra os outros." />

        <div className="grid gap-1.5">
          <label htmlFor="service-name" className="text-sm font-semibold">Nome do serviço</label>
          <input
            id="service-name"
            value={serviceName}
            autoCapitalize="sentences"
            maxLength={120}
            aria-invalid={attempted && !nameOk ? true : undefined}
            aria-describedby={attempted && !nameOk ? "service-name-error" : undefined}
            onChange={(event) => onChangeServiceName(event.target.value)}
            className="onb-control min-h-12 w-full rounded-field border border-line-strong/60 bg-surface px-3.5 text-base text-ink aria-invalid:border-danger"
          />
          <FieldError id="service-name-error">{attempted && !nameOk ? NAME_ERROR : null}</FieldError>
        </div>

        <div className="grid gap-2">
          <span id="duration-label" className="text-sm font-semibold">Duração</span>
          <div role="radiogroup" aria-labelledby="duration-label" className="grid grid-cols-5 gap-1 rounded-[14px] bg-subtle p-1">
            {PRESETS.map((item) => {
              const selected = !customOpen && durationMinutes === item.minutes;
              return (
                <button
                  key={item.minutes}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setCustomOpen(false);
                    onChangeDuration(item.minutes);
                  }}
                  className={cn("min-h-11 rounded-[10px] px-1 text-[13px] font-semibold", selected ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted")}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={customOpen}
              onClick={() => {
                setCustomOpen(true);
                window.setTimeout(() => document.getElementById("service-duration-custom")?.focus(), 0);
              }}
              className={cn("min-h-11 rounded-[10px] px-1 text-[13px] font-semibold", customOpen ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted")}
            >
              Outra
            </button>
          </div>
          {customOpen ? (
            <input
              id="service-duration-custom"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Duração em minutos"
              aria-invalid={attempted && !durationOk ? true : undefined}
              aria-describedby={attempted && !durationOk ? "duration-error" : undefined}
              value={durationMinutes > 0 ? String(durationMinutes) : ""}
              onChange={(event) => onChangeDuration(Number(event.target.value.replace(/\D/g, "").slice(0, 3)) || 0)}
              className="onb-control min-h-12 w-full rounded-field border border-line-strong/60 bg-surface px-3.5 text-base tabular-nums text-ink aria-invalid:border-danger"
            />
          ) : null}
          <FieldError id="duration-error">{attempted && !durationOk ? DURATION_ERROR : null}</FieldError>
        </div>

        <MoneyInput
          id="service-price"
          label="Preço do serviço"
          labelSuffix="em reais"
          valueCents={price}
          onChangeCents={setPrice}
          error={attempted && !priceOk ? PRICE_ERROR : null}
          hint={PRICE_HINT}
        />

        <div className="grid gap-2">
          <span id="deposit-label" className="text-sm font-semibold">Sinal cobrado no Pix</span>
          <div role="group" aria-labelledby="deposit-label" className="flex flex-wrap gap-2">
            {PERCENTS.map((percent) => {
              const selected = depositMode === String(percent);
              return (
                <button key={percent} type="button" aria-pressed={selected} onClick={() => setMode(String(percent) as DepositMode)} className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink")}>
                  {percent}%
                </button>
              );
            })}
            <button type="button" aria-pressed={depositMode === "custom"} onClick={() => setMode("custom")} className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", depositMode === "custom" ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink")}>
              Outro valor
            </button>
            <button type="button" aria-pressed={noDeposit} onClick={() => setMode("none")} className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", noDeposit ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink")}>
              Sem sinal
            </button>
          </div>
          {depositMode === "custom" ? (
            <MoneyInput
              id="service-deposit"
              label="Outro valor"
              hideLabel
              valueCents={depositCents > 0 ? depositCents : null}
              onChangeCents={(cents) => onChangeDeposit(cents ?? 0)}
              error={!depositOk ? DEPOSIT_ERROR : null}
            />
          ) : null}
          {!noDeposit && depositMode !== "custom" ? (
            <p className="text-sm font-semibold">
              Sinal: <span className="tabular-nums">{priced ? `R$ ${formatCents(depositCents)}` : "R$ —"}</span>
            </p>
          ) : null}
          {!noDeposit ? <p className="text-sm text-muted">{DEPOSIT_HINT}</p> : null}
          <FieldError>{depositMode !== "custom" && !depositOk ? DEPOSIT_ERROR : null}</FieldError>
        </div>

        {/* FE-23 entra aqui. Sem sinal (depositCents = 0) não renderiza o ponto. */}
        {showPolicy ? <div data-slot="deposit-policy">{policy}</div> : null}

        <section className="overflow-hidden rounded-card border border-line bg-surface" aria-label="Como aparece para o seu cliente">
          <h2 className="border-b border-line bg-subtle px-4 py-3 text-xs text-muted">Como aparece para o seu cliente</h2>
          <div className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">{serviceName.trim() || "Serviço"}{shownDuration != null ? ` · ${durationLabel(shownDuration)}` : ""}</span>
            <b className="shrink-0 tabular-nums">{preview.view.priceLabel}</b>
          </div>
          {summaryNoDeposit ? (
            <p className="border-t border-line px-4 py-2.5 text-sm">{NO_DEPOSIT}</p>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm">
              <span>{DEPOSIT_NOW_LABEL}</span>
              <b className="tabular-nums text-pix">{preview.view.depositLabel}</b>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm text-muted">
            <span>{REMAINDER_LABEL}</span>
            <b className="tabular-nums">{preview.view.remainderLabel}</b>
          </div>
        </section>
      </div>
      <StepActions onBack={onBack} submitLabel="Continuar" disabled={!canContinue} onInvalid={focusFirstProblem} />
    </form>
  );
}
