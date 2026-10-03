import React, { useEffect, useState, useMemo } from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatTimeSlot, formatCurrency } from "./formatters";
import { Button } from "@/components/ui/button";

interface StepSlotProps {
  slug: string;
  service: PublicService;
  timezone: string;
  selectedStartsAt: string | null;
  onSelectSlot: (slot: AvailabilitySlot) => void;
  onBack: () => void;
  onNext: () => void;
  getSlotsForDate?: (dateString: string) => Promise<AvailabilitySlot[]>;
}

interface DayOption {
  dateString: string; // YYYY-MM-DD
  dayLabel: string;   // "Hoje", "Amanhã", "Sex", "Sáb"...
  dateNumber: string; // "02/10"
}

function generateInitialDays(timezone: string): DayOption[] {
  const list: DayOption[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    let dateString = "";
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
      }).formatToParts(d);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      dateString = `${y}-${m}-${day}`;
    } catch {
      dateString = d.toISOString().slice(0, 10);
    }

    let dayLabel = "";
    if (i === 0) dayLabel = "Hoje";
    else if (i === 1) dayLabel = "Amanhã";
    else {
      const weekdayName = new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        timeZone: timezone,
      }).format(d);
      dayLabel = weekdayName.replace(".", "").toUpperCase();
    }

    const dateNumber = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
    }).format(d);

    list.push({
      dateString,
      dayLabel,
      dateNumber,
    });
  }
  return list;
}

export function StepSlot({
  slug,
  service,
  timezone,
  selectedStartsAt,
  onSelectSlot,
  onBack,
  onNext,
  getSlotsForDate,
}: StepSlotProps) {
  const days = useMemo(() => generateInitialDays(timezone), [timezone]);
  const [selectedDate, setSelectedDate] = useState<string>(() => days[0]?.dateString || "");
  const [daySlotCounts, setDaySlotCounts] = useState<Record<string, number | null>>({});
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(true);
  const [errorSlots, setErrorSlots] = useState<string | null>(null);

  const [slotsRetryCount, setSlotsRetryCount] = useState<number>(0);

  // Carrega contagens de vagas para todos os 7 dias em background
  useEffect(() => {
    let isCancelled = false;

    days.forEach((day) => {
      const promise = getSlotsForDate
        ? getSlotsForDate(day.dateString)
        : fetch(`/api/public/${slug}/availability?serviceId=${service.id}&date=${day.dateString}`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => data.slots || []);

      promise
        .then((dataSlots: AvailabilitySlot[]) => {
          if (isCancelled) return;
          const count = Array.isArray(dataSlots) ? dataSlots.length : 0;
          setDaySlotCounts((prev) => ({ ...prev, [day.dateString]: count }));
        })
        .catch(() => {
          if (isCancelled) return;
          setDaySlotCounts((prev) => ({ ...prev, [day.dateString]: 0 }));
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [slug, service.id, days, getSlotsForDate]);

  // Carrega horários detalhados da data selecionada
  useEffect(() => {
    if (!selectedDate) return;

    let isCancelled = false;

    const loadSlots = async () => {
      try {
        let loadedSlots: AvailabilitySlot[] = [];
        if (getSlotsForDate) {
          loadedSlots = await getSlotsForDate(selectedDate);
        } else {
          const res = await fetch(`/api/public/${slug}/availability?serviceId=${service.id}&date=${selectedDate}`);
          if (!res.ok) throw new Error("Não foi possível carregar os horários.");
          const data = await res.json();
          loadedSlots = data.slots || [];
        }
        if (isCancelled) return;
        setSlots(loadedSlots);
        setErrorSlots(null);
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : "Erro ao consultar horários.";
        setErrorSlots(msg);
      } finally {
        if (!isCancelled) {
          setIsLoadingSlots(false);
        }
      }
    };

    void loadSlots();

    return () => {
      isCancelled = true;
    };
  }, [slug, service.id, selectedDate, slotsRetryCount, getSlotsForDate]);

  const handleSelectDay = (dateStr: string) => {
    if (dateStr === selectedDate) return;
    setIsLoadingSlots(true);
    setSelectedDate(dateStr);
  };

  const handleRetrySlots = () => {
    setIsLoadingSlots(true);
    setErrorSlots(null);
    setSlotsRetryCount((c) => c + 1);
  };

  const selectedSlot = slots.find((s) => s.startsAt === selectedStartsAt);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Escolha o horário</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {service.name} • {service.depositCents > 0 ? `Sinal: ${formatCurrency(service.depositCents)}` : "Sem sinal"}
        </p>
      </div>

      {/* Régua Tátil de Dias (Elemento Memorável) */}
      <section aria-label="Régua de datas disponíveis">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
          {days.map((day) => {
            const isCurrent = day.dateString === selectedDate;
            const count = daySlotCounts[day.dateString];
            const hasSlots = count !== undefined && count !== null && count > 0;
            const isZero = count === 0;

            return (
              <button
                key={day.dateString}
                type="button"
                aria-pressed={isCurrent}
                aria-current={isCurrent ? "date" : undefined}
                onClick={() => handleSelectDay(day.dateString)}
                className={`flex flex-col items-center justify-center min-w-[76px] py-2 px-2.5 rounded-xl border text-center transition-all min-h-11 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-surface text-foreground hover:bg-muted/60"
                }`}
              >
                <span className={`text-xs font-semibold ${isCurrent ? "text-primary-foreground" : "text-foreground"}`}>
                  {day.dayLabel}
                </span>
                <span className={`text-[11px] mt-0.5 ${isCurrent ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                  {day.dateNumber}
                </span>
                <span
                  className={`text-[10px] mt-1 font-medium px-1.5 py-0.5 rounded-full ${
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isZero
                      ? "bg-muted text-muted-foreground/80"
                      : hasSlots
                      ? "bg-primary/10 text-primary font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count === undefined || count === null
                    ? "..."
                    : isZero
                    ? "Sem vagas"
                    : `${count} vaga${count > 1 ? "s" : ""}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Grade de Horários */}
      <section aria-label="Horários disponíveis no dia" className="space-y-3">
        {isLoadingSlots ? (
          <div className="grid grid-cols-3 gap-2.5" role="status" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 bg-muted animate-pulse rounded-lg" />
            ))}
            <span className="sr-only">Carregando horários disponíveis...</span>
          </div>
        ) : errorSlots ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <p className="text-sm font-medium text-destructive">{errorSlots}</p>
            <Button
              variant="outline"
              onClick={handleRetrySlots}
              className="mt-3 min-h-11"
            >
              Tentar novamente
            </Button>
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-surface/50">
            <p className="text-sm font-medium text-foreground">Sem horários livres para este dia</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os horários já foram reservados ou o local estará fechado. Toque em outro dia na régua acima.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Horários disponíveis">
            {slots.map((slot) => {
              const isSelected = slot.startsAt === selectedStartsAt;
              const timeLabel = formatTimeSlot(slot.startsAt, timezone);

              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectSlot(slot)}
                  className={`min-h-11 flex items-center justify-center font-medium text-sm rounded-lg border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  {timeLabel}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Ações Voltar / Avançar */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 min-h-11 font-medium"
        >
          Voltar
        </Button>
        <Button
          type="button"
          disabled={!selectedSlot}
          onClick={onNext}
          className="flex-[2] min-h-11 font-semibold"
        >
          {selectedSlot ? "Preencher meus dados" : "Selecione um horário"}
        </Button>
      </div>
    </div>
  );
}
