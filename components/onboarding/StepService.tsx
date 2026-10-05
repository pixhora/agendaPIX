import React from "react";
import { ShieldCheck } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { FieldError, FieldHint } from "@/components/ui/field";
import { StepActions, StepHeader } from "./parts";

interface StepServiceProps {
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  onChangeServiceName: (val: string) => void;
  onChangeDuration: (val: number) => void;
  onChangePrice: (cents: number) => void;
  onChangeDeposit: (cents: number) => void;
  onBack: () => void;
  onNext: () => void;
}

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function StepService({
  serviceName,
  durationMinutes,
  priceCents,
  depositCents,
  onChangeServiceName,
  onChangeDuration,
  onChangePrice,
  onChangeDeposit,
  onBack,
  onNext,
}: StepServiceProps) {
  const isDepositValid = depositCents <= priceCents;
  const isValid = serviceName.trim().length >= 2 && durationMinutes > 0 && priceCents > 0 && depositCents >= 0 && isDepositValid;
  const suggestions = priceCents > 0 ? [0.2, 0.3, 0.5].map((ratio) => Math.round((priceCents * ratio) / 100) * 100).filter((value, index, list) => value > 0 && list.indexOf(value) === index) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader title="Seu primeiro serviço" description="Comece pelo mais pedido. Você cadastra os outros depois, no painel." />

      <div className="grid gap-1.5">
        <label htmlFor="service-name" className="text-sm font-semibold">Nome do serviço</label>
        <Input id="service-name" type="text" required placeholder="Ex.: Corte de cabelo, Manicure" value={serviceName} onChange={(e) => onChangeServiceName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 grid gap-1.5 sm:col-span-1">
          <label htmlFor="service-duration" className="text-sm font-semibold">Duração</label>
          <Select id="service-duration" value={durationMinutes} onChange={(e) => onChangeDuration(Number(e.target.value))}>
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={50}>50 minutos</option>
            <option value={60}>1 hora</option>
            <option value={90}>1h 30min</option>
            <option value={120}>2 horas</option>
          </Select>
        </div>
        <div className="col-span-2 grid gap-1.5 sm:col-span-1">
          <label htmlFor="service-price" className="text-sm font-semibold">Valor total</label>
          <span className="relative block">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-muted">R$</span>
            <Input id="service-price" type="number" inputMode="numeric" min="1" step="1" required className="pl-10 tabular-nums" value={priceCents > 0 ? (priceCents / 100).toString() : ""} onChange={(e) => onChangePrice(Math.round(Number(e.target.value) * 100))} placeholder="50" />
          </span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="service-deposit" className="text-sm font-semibold">Sinal no Pix para reservar</label>
        <span className="relative block">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-muted">R$</span>
          <Input
            id="service-deposit"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            className="pl-10 tabular-nums"
            aria-invalid={!isDepositValid ? "true" : undefined}
            aria-describedby={!isDepositValid ? "deposit-error" : "deposit-hint"}
            value={depositCents >= 0 ? (depositCents / 100).toString() : ""}
            onChange={(e) => onChangeDeposit(Math.round(Number(e.target.value) * 100))}
            placeholder="20"
          />
        </span>
        {!isDepositValid ? (
          <FieldError id="deposit-error">O sinal ({money(depositCents)}) não pode ser maior que o valor do serviço ({money(priceCents)}).</FieldError>
        ) : (
          <FieldHint id="deposit-hint">Recomendado: 20% a 50% do valor. Zero confirma sem cobrar sinal.</FieldHint>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Sugestões de sinal">
            {suggestions.map((value) => (
              <button key={value} type="button" aria-pressed={depositCents === value} onClick={() => onChangeDeposit(value)} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-semibold tabular-nums transition-feedback hover:border-line-strong aria-pressed:border-pix aria-pressed:bg-pix-soft aria-pressed:text-pix focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {money(value)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 rounded-card border border-pix/25 bg-pix-soft p-4 text-sm">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pix" />
        <p><span className="font-semibold">O sinal garante a presença.</span> O Pix é gerado a cada reserva e a confirmação chega sozinha, sem pedir comprovante no WhatsApp.</p>
      </div>

      <StepActions onBack={onBack} submitLabel="Continuar" disabled={!isValid} />
    </form>
  );
}
