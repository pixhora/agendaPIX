"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatTimeSlot, formatCurrency, formatDateFull } from "./formatters";
import { ArrowLeft, ArrowRight, CalendarX2, Moon, Sun, Sunrise } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { publicAvailabilityUrl } from "@/lib/public-api";

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

type Period = "morning" | "afternoon" | "evening";
const PERIODS: { id: Period; label: string; Icon: typeof Sun }[] = [
  { id: "morning", label: "Manhã", Icon: Sunrise },
  { id: "afternoon", label: "Tarde", Icon: Sun },
  { id: "evening", label: "Noite", Icon: Moon },
];

/** Agrupa horários em manhã (<12h), tarde (12–18h) e noite (≥18h) no fuso do negócio. */
export function groupSlotsByPeriod(slots: AvailabilitySlot[], timezone: string): Record<Period, AvailabilitySlot[]> {
  const groups: Record<Period, AvailabilitySlot[]> = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    const hour = Number(formatTimeSlot(slot.startsAt, timezone).slice(0, 2));
    groups[hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"].push(slot);
  }
  return groups;
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

  const rulerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const updateScrollIndicators = React.useCallback(() => {
    const el = rulerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener("scroll", updateScrollIndicators, { passive: true });
    window.addEventListener("resize", updateScrollIndicators);
    return () => {
      el.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateScrollIndicators);
    };
  }, [updateScrollIndicators, days]);

  const getSlotsRef = React.useRef(getSlotsForDate);
  React.useEffect(() => {
    getSlotsRef.current = getSlotsForDate;
  });

  // Carrega contagens de vagas para todos os 7 dias em background
  useEffect(() => {
    let isCancelled = false;
    const controllers: AbortController[] = [];

    days.forEach((day) => {
      const fetchFn = getSlotsRef.current;
      const controller = new AbortController();
      controllers.push(controller);
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000);

      const promise = fetchFn
        ? fetchFn(day.dateString)
        : fetch(publicAvailabilityUrl(slug, service.id, day.dateString), {
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => data.slots || [])
            .finally(() => clearTimeout(timeoutId));

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
      controllers.forEach((c) => c.abort());
    };
  }, [slug, service.id, days]);

  // Carrega horários detalhados da data selecionada
  useEffect(() => {
    if (!selectedDate) return;

    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000);

    const loadSlots = async () => {
      try {
        let loadedSlots: AvailabilitySlot[] = [];
        const fetchFn = getSlotsRef.current;
        if (fetchFn) {
          loadedSlots = await fetchFn(selectedDate);
        } else {
          const res = await fetch(
            publicAvailabilityUrl(slug, service.id, selectedDate),
            {
              signal: controller.signal,
            }
          );
          if (!res.ok) throw new Error("Não foi possível carregar os horários.");
          const data = await res.json();
          loadedSlots = data.slots || [];
        }
        if (isCancelled) return;
        setSlots(loadedSlots);
        setErrorSlots(null);
      } catch (err: unknown) {
        if (isCancelled) return;
        let msg = "Erro ao consultar horários.";
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            msg = "A consulta de horários demorou muito. Tente novamente.";
          } else {
            msg = err.message;
          }
        }
        setErrorSlots(msg);
      } finally {
        clearTimeout(timeoutId);
        if (!isCancelled) {
          setIsLoadingSlots(false);
        }
      }
    };

    void loadSlots();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [slug, service.id, selectedDate, slotsRetryCount]);

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

  const groups = groupSlotsByPeriod(slots, timezone);
  const nextDayWithSlots = days.find((day) => day.dateString > selectedDate && (daySlotCounts[day.dateString] ?? 0) > 0);

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + days.length) % days.length;
    rulerRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Escolha o dia e o horário</h2>
        <p className="mt-1 text-sm text-muted">
          {service.name} · {service.depositCents > 0 ? `sinal de ${formatCurrency(service.depositCents)} por Pix` : "sem sinal"}
        </p>
      </div>

      {/* Faixa horizontal de dias (pills) */}
      <section aria-label="Régua de datas disponíveis">
        <div className="relative -mx-1">
          <div
            className={cn("pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent transition-opening", canScrollLeft ? "opacity-100" : "opacity-0")}
            aria-hidden="true"
          />
          <div
            className={cn("pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface to-transparent transition-opening", canScrollRight ? "opacity-100" : "opacity-0")}
            aria-hidden="true"
          />
          <div ref={rulerRef} className="flex snap-x gap-2 overflow-x-auto scroll-smooth scroll-px-1 p-1 scrollbar-hide" role="group" aria-label="Selecione uma data">
            {days.map((day, index) => {
              const isCurrent = day.dateString === selectedDate;
              const count = daySlotCounts[day.dateString];
              const isZero = count === 0;
              const [dd] = day.dateNumber.split("/");
              return (
                <button
                  key={day.dateString}
                  type="button"
                  data-testid="day-option"
                  aria-pressed={isCurrent}
                  aria-current={isCurrent ? "date" : undefined}
                  aria-label={`${day.dayLabel}, ${formatDateFull(`${day.dateString}T12:00:00Z`, "UTC")}${count == null ? "" : isZero ? ", sem vagas" : `, ${count} ${count === 1 ? "vaga" : "vagas"}`}`}
                  onClick={() => handleSelectDay(day.dateString)}
                  onKeyDown={(event) => handleDayKeyDown(event, index)}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })}
                  className={cn(
                    "flex min-h-[84px] w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border text-center transition-feedback active:scale-[0.98]",
                    isCurrent ? "border-ink bg-ink text-paper shadow-[var(--shadow-card)]" : "border-line bg-surface text-ink hover:border-line-strong",
                    isZero && !isCurrent && "text-muted",
                  )}
                >
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", isCurrent ? "text-paper/80" : "text-muted")}>{day.dayLabel}</span>
                  <span className="font-display text-xl font-bold tabular-nums leading-none">{dd}</span>
                  <span aria-hidden="true" className={cn("mt-1 h-1.5 w-1.5 rounded-full", count == null ? "bg-line" : isZero ? "bg-transparent ring-1 ring-line-strong" : isCurrent ? "bg-pix-bright" : "bg-pix")} />
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-pix" />com vagas</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full ring-1 ring-line-strong" />sem vagas</span>
        </p>
      </section>

      {/* Horários agrupados por período */}
      <section aria-label="Horários disponíveis no dia" className="space-y-5" aria-busy={isLoadingSlots}>
        {isLoadingSlots ? (
          <div role="status" className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
            <span className="sr-only">Carregando horários disponíveis...</span>
          </div>
        ) : errorSlots ? (
          <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-center">
            <p className="text-sm font-semibold text-danger">{errorSlots}</p>
            <Button type="button" variant="outline" onClick={handleRetrySlots} className="mt-3">
              Tentar novamente
            </Button>
          </div>
        ) : slots.length === 0 ? (
          <div role="status" className="flex flex-col items-center rounded-card border border-dashed border-line-strong/60 px-4 py-8 text-center">
            <CalendarX2 aria-hidden="true" className="size-7 text-muted" />
            <p className="mt-3 font-semibold text-ink">Sem horários neste dia</p>
            <p className="mt-1 text-sm text-muted">Escolha outro dia na faixa acima.</p>
            {nextDayWithSlots && (
              <Button type="button" variant="outline" className="mt-4" onClick={() => handleSelectDay(nextDayWithSlots.dateString)}>
                Ver {nextDayWithSlots.dayLabel === "Amanhã" ? "amanhã" : `${nextDayWithSlots.dayLabel.toLowerCase()} ${nextDayWithSlots.dateNumber}`}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        ) : (
          <div role="radiogroup" aria-label="Horários disponíveis" className="space-y-5">
            {PERIODS.filter((period) => groups[period.id].length > 0).map(({ id, label, Icon }) => (
              <div key={id} role="group" aria-label={label}>
                <h3 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink">
                  <Icon aria-hidden="true" className="size-4 text-muted" />
                  {label}
                  <span className="font-normal text-muted">· {groups[id].length}</span>
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {groups[id].map((slot) => {
                    const isSelected = slot.startsAt === selectedStartsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onSelectSlot(slot)}
                        className={cn(
                          "min-h-12 rounded-xl border text-base font-semibold tabular-nums transition-feedback active:scale-[0.98]",
                          isSelected ? "border-ink bg-ink text-paper shadow-[var(--shadow-card)]" : "border-line bg-surface text-ink hover:border-ink",
                        )}
                      >
                        {formatTimeSlot(slot.startsAt, timezone)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="sm:-ml-3">
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
        <Button type="button" size="lg" onClick={onNext} disabled={!selectedSlot} className="w-full sm:w-auto">
          {selectedSlot ? `Continuar com ${formatTimeSlot(selectedSlot.startsAt, timezone)}` : "Escolha um horário"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
