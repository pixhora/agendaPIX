import React from "react";
import { Button } from "@/components/ui/button";

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
  const isValid =
    serviceName.trim().length >= 2 &&
    durationMinutes > 0 &&
    priceCents > 0 &&
    depositCents >= 0 &&
    isDepositValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          Cadastre seu primeiro serviço
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Você poderá cadastrar mais serviços e pacotes depois no painel.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="service-name" className="block text-sm font-medium text-foreground mb-1.5">
            Nome do serviço
          </label>
          <input
            id="service-name"
            type="text"
            required
            placeholder="Ex: Corte de Cabelo, Barba Terapia, Manicure..."
            value={serviceName}
            onChange={(e) => onChangeServiceName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="service-duration" className="block text-xs font-semibold text-foreground mb-1.5">
              Duração
            </label>
            <select
              id="service-duration"
              value={durationMinutes}
              onChange={(e) => onChangeDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={50}>50 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1h 30min</option>
              <option value={120}>2 horas</option>
            </select>
          </div>

          <div>
            <label htmlFor="service-price" className="block text-xs font-semibold text-foreground mb-1.5">
              Valor total (R$)
            </label>
            <input
              id="service-price"
              type="number"
              min="1"
              step="1"
              required
              value={priceCents > 0 ? (priceCents / 100).toString() : ""}
              onChange={(e) => onChangePrice(Math.round(Number(e.target.value) * 100))}
              placeholder="Ex: 50"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div>
            <label htmlFor="service-deposit" className="block text-xs font-semibold text-foreground mb-1.5">
              Sinal no Pix (R$)
            </label>
            <input
              id="service-deposit"
              type="number"
              min="0"
              step="1"
              aria-invalid={!isDepositValid ? "true" : undefined}
              aria-describedby={!isDepositValid ? "deposit-error" : undefined}
              value={depositCents >= 0 ? (depositCents / 100).toString() : ""}
              onChange={(e) => onChangeDeposit(Math.round(Number(e.target.value) * 100))}
              placeholder="Ex: 20"
              className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-foreground min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                !isDepositValid
                  ? "border-destructive focus-visible:outline-destructive"
                  : "border-border focus-visible:outline-primary"
              }`}
            />
          </div>
        </div>

        {!isDepositValid && (
          <div
            id="deposit-error"
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive font-medium"
          >
            O sinal no Pix (R$ {(depositCents / 100).toFixed(0)}) não pode ser maior que o valor total do serviço (R$ {(priceCents / 100).toFixed(0)}).
          </div>
        )}

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-primary">💡 Dica sobre o sinal:</p>
          <p>
            Recomendamos cobrar entre 20% e 50% do valor como sinal no Pix (ex: R$ 15 ou R$ 20). Isso garante que o cliente não falte sem criar barreira de entrada.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1 min-h-11 font-medium">
          Voltar
        </Button>
        <Button type="submit" disabled={!isValid} className="flex-[2] min-h-11 font-semibold">
          Continuar
        </Button>
      </div>
    </form>
  );
}
