"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fieldShell } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CHIP_TIMES,
  HOURS_COMPARISON,
  TIME_STEP_MINUTES,
  WEEKDAYS,
  copyRangesToOtherDays,
  emptyWeek,
  nearestTime,
  nextRange,
  timeOptions,
  withDay,
  type DaySchedule,
  type TimeRange,
} from "./hours-model";

const references = [
  { href: "https://ui.shadcn.com/docs/components/radix/select", label: "shadcn/ui Select" },
  { href: "https://www.radix-ui.com/primitives/docs/components/select", label: "Radix Select" },
  { href: "https://react-aria.adobe.com/TimeField", label: "React Aria TimeField" },
  { href: "https://mantine.dev/dates/time-input/", label: "Mantine TimeInput" },
  { href: "https://mantine.dev/dates/time-picker/", label: "Mantine TimePicker" },
  { href: "https://cal.com/help/availabilities/set-up-your-availability", label: "Cal.com — disponibilidade" },
  { href: "https://calendly.com/help/how-to-set-your-availability", label: "Calendly — horários semanais" },
];

function useWeek() {
  const [days, setDays] = useState<DaySchedule[]>(emptyWeek);
  return { days, setDays };
}

function DaySwitch({ day, checked, onChecked }: { day: string; checked: boolean; onChecked: (open: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <span className="inline-flex rounded-full focus-within:shadow-focus">
        <Switch checked={checked} aria-label={`${day}: aberto`} onChange={(event) => onChecked(event.target.checked)} />
      </span>
      <span className="font-semibold">{day}</span>
      <span className={cn("ml-auto text-xs font-semibold sm:hidden", checked ? "text-success" : "text-muted")}>{checked ? "Aberto" : "Fechado"}</span>
    </label>
  );
}

function ScrollToTime({ time }: { time: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    ref.current?.closest("[data-slot=select-content]")?.querySelector<HTMLElement>(`[data-time="${time}"]`)?.scrollIntoView({ block: "center" });
  }, [time]);
  return <span ref={ref} className="sr-only" />;
}

function TimeSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const anchor = value || nearestTime();
  return (
    <div className="grid min-w-0 gap-1">
      <label className="text-xs font-semibold text-muted" htmlFor={id}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="tabular-nums">
          <SelectValue placeholder="--:--" />
        </SelectTrigger>
        <SelectContent>
          <ScrollToTime time={anchor} />
          {timeOptions().map((time) => (
            <SelectItem key={time} value={time} data-time={time} className="tabular-nums">{time}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RangeError({ range }: { range: TimeRange }) {
  if (range.start < range.end) return null;
  return <p role="alert" className="text-sm font-medium text-danger">O fim precisa ser depois do início.</p>;
}

function CopyButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4" onClick={onClick}>
      Copiar para os outros dias
    </button>
  );
}

function AddRange({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink" onClick={onClick}>
      + intervalo
    </button>
  );
}

function RemoveRange({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted" onClick={onClick}>
      Remover intervalo
    </button>
  );
}

function WeekFrame({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line rounded-field border border-line">{children}</div>;
}

function ListPrototype() {
  const { days, setDays } = useWeek();
  return (
    <WeekFrame>
      {WEEKDAYS.map((meta) => {
        const day = days.find((item) => item.weekday === meta.weekday)!;
        return (
          <div key={meta.weekday} className="grid gap-2 px-3 py-3 sm:px-4">
            <DaySwitch
              day={meta.label}
              checked={day.open}
              onChecked={(open) => setDays(withDay(days, meta.weekday, (current) => ({ ...current, open })))}
            />
            {day.open ? day.ranges.map((range, index) => (
              <div key={`${meta.weekday}-${index}`} className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <TimeSelect
                    id={`lista-${meta.weekday}-${index}-inicio`}
                    label="Início"
                    value={range.start}
                    onChange={(start) => setDays(withDay(days, meta.weekday, (current) => ({
                      ...current,
                      ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, start } : item),
                    })))}
                  />
                  <TimeSelect
                    id={`lista-${meta.weekday}-${index}-fim`}
                    label="Fim"
                    value={range.end}
                    onChange={(end) => setDays(withDay(days, meta.weekday, (current) => ({
                      ...current,
                      ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, end } : item),
                    })))}
                  />
                </div>
                <RangeError range={range} />
                {day.ranges.length > 1 ? (
                  <RemoveRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                    ...current,
                    ranges: current.ranges.filter((_, itemIndex) => itemIndex !== index),
                  })))} />
                ) : null}
              </div>
            )) : null}
            {day.open ? (
              <div className="flex flex-wrap items-center gap-x-4">
                <AddRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                  ...current,
                  ranges: [...current.ranges, nextRange(current.ranges)],
                })))} />
                <CopyButton onClick={() => setDays(copyRangesToOtherDays(days, meta.weekday))} />
              </div>
            ) : null}
          </div>
        );
      })}
    </WeekFrame>
  );
}

function padPart(raw: string, max: number) {
  const digits = raw.replace(/\D/g, "");
  const value = Math.min(max, Number(digits || "0"));
  return String(value).padStart(2, "0");
}

function SegmentedTime({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [hour = "09", minute = "00"] = value.split(":");
  const [hourDraft, setHourDraft] = useState(hour);
  const [minuteDraft, setMinuteDraft] = useState(minute);
  const [source, setSource] = useState(value);
  const minuteRef = useRef<HTMLInputElement>(null);
  if (source !== value) {
    setSource(value);
    setHourDraft(hour);
    setMinuteDraft(minute);
  }
  function commit(nextHour: string, nextMinute: string) {
    onChange(`${padPart(nextHour, 23)}:${padPart(nextMinute, 59)}`);
  }
  function bump(part: "hour" | "minute", delta: number) {
    if (part === "hour") {
      commit(String((Number(hour) + delta + 24) % 24), minute);
      return;
    }
    const snapped = Math.round(Number(minute) / 15) * 15;
    commit(hour, String((snapped + delta * 15 + 60) % 60));
  }
  return (
    <div className="grid min-w-0 gap-1">
      <span id={`${id}-label`} className="text-xs font-semibold text-muted">{label}</span>
      <div role="group" aria-labelledby={`${id}-label`} className={cn(fieldShell, "gap-1 px-3 tabular-nums")}>
        <input
          id={id}
          role="spinbutton"
          aria-label={`${label}, hora`}
          aria-valuemin={0}
          aria-valuemax={23}
          aria-valuenow={Number(hour)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          value={hourDraft}
          className="w-8 bg-transparent text-center text-base text-ink outline-none"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
            setHourDraft(digits);
            if (digits.length === 2) {
              commit(digits, minuteDraft);
              minuteRef.current?.focus();
              minuteRef.current?.select();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") { event.preventDefault(); bump("hour", 1); }
            if (event.key === "ArrowDown") { event.preventDefault(); bump("hour", -1); }
          }}
          onBlur={() => commit(hourDraft, minuteDraft)}
        />
        <span aria-hidden="true" className="text-muted">:</span>
        <input
          ref={minuteRef}
          role="spinbutton"
          aria-label={`${label}, minuto`}
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={Number(minute)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          value={minuteDraft}
          className="w-8 bg-transparent text-center text-base text-ink outline-none"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
            setMinuteDraft(digits);
            if (digits.length === 2) commit(hourDraft, digits);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") { event.preventDefault(); bump("minute", 1); }
            if (event.key === "ArrowDown") { event.preventDefault(); bump("minute", -1); }
          }}
          onBlur={() => commit(hourDraft, minuteDraft)}
        />
      </div>
    </div>
  );
}

function TypedPrototype() {
  const { days, setDays } = useWeek();
  return (
    <WeekFrame>
      {WEEKDAYS.map((meta) => {
        const day = days.find((item) => item.weekday === meta.weekday)!;
        return (
          <div key={meta.weekday} className="grid gap-2 px-3 py-3 sm:px-4">
            <DaySwitch
              day={meta.label}
              checked={day.open}
              onChecked={(open) => setDays(withDay(days, meta.weekday, (current) => ({ ...current, open })))}
            />
            {day.open ? day.ranges.map((range, index) => (
              <div key={`${meta.weekday}-${index}`} className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <SegmentedTime
                    id={`digitar-${meta.weekday}-${index}-inicio`}
                    label="Início"
                    value={range.start}
                    onChange={(start) => setDays(withDay(days, meta.weekday, (current) => ({
                      ...current,
                      ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, start } : item),
                    })))}
                  />
                  <SegmentedTime
                    id={`digitar-${meta.weekday}-${index}-fim`}
                    label="Fim"
                    value={range.end}
                    onChange={(end) => setDays(withDay(days, meta.weekday, (current) => ({
                      ...current,
                      ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, end } : item),
                    })))}
                  />
                </div>
                <RangeError range={range} />
                {day.ranges.length > 1 ? (
                  <RemoveRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                    ...current,
                    ranges: current.ranges.filter((_, itemIndex) => itemIndex !== index),
                  })))} />
                ) : null}
              </div>
            )) : null}
            {day.open ? (
              <div className="flex flex-wrap items-center gap-x-4">
                <AddRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                  ...current,
                  ranges: [...current.ranges, nextRange(current.ranges)],
                })))} />
                <CopyButton onClick={() => setDays(copyRangesToOtherDays(days, meta.weekday))} />
              </div>
            ) : null}
          </div>
        );
      })}
    </WeekFrame>
  );
}

function ChipRow({ label, value, onChange, id }: { label: string; value: string; onChange: (value: string) => void; id: string }) {
  const known = CHIP_TIMES.includes(value as (typeof CHIP_TIMES)[number]);
  return (
    <div className="grid gap-1">
      <span id={id} className="text-xs font-semibold text-muted">{label}</span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {CHIP_TIMES.map((time) => {
          const pressed = value === time;
          return (
            <button
              key={time}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(time)}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold tabular-nums",
                pressed ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
              )}
            >
              {time}
            </button>
          );
        })}
        <Select key={known ? "chip" : value} value={known ? undefined : value} onValueChange={onChange}>
          <SelectTrigger id={`${id}-outro`} aria-labelledby={id} className="w-auto min-w-28 font-semibold">
            <SelectValue placeholder="Outro" />
          </SelectTrigger>
          <SelectContent>
            {timeOptions(15).map((time) => (
              <SelectItem key={time} value={time} data-time={time} className="tabular-nums">{time}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ChipsPrototype() {
  const { days, setDays } = useWeek();
  return (
    <WeekFrame>
      {WEEKDAYS.map((meta) => {
        const day = days.find((item) => item.weekday === meta.weekday)!;
        return (
          <div key={meta.weekday} className="grid gap-3 px-3 py-3 sm:px-4">
            <DaySwitch
              day={meta.label}
              checked={day.open}
              onChecked={(open) => setDays(withDay(days, meta.weekday, (current) => ({ ...current, open })))}
            />
            {day.open ? day.ranges.map((range, index) => (
              <div key={`${meta.weekday}-${index}`} className="grid gap-2">
                <ChipRow
                  id={`chips-${meta.weekday}-${index}-inicio`}
                  label="Início"
                  value={range.start}
                  onChange={(start) => setDays(withDay(days, meta.weekday, (current) => ({
                    ...current,
                    ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, start } : item),
                  })))}
                />
                <ChipRow
                  id={`chips-${meta.weekday}-${index}-fim`}
                  label="Fim"
                  value={range.end}
                  onChange={(end) => setDays(withDay(days, meta.weekday, (current) => ({
                    ...current,
                    ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, end } : item),
                  })))}
                />
                <RangeError range={range} />
                {day.ranges.length > 1 ? (
                  <RemoveRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                    ...current,
                    ranges: current.ranges.filter((_, itemIndex) => itemIndex !== index),
                  })))} />
                ) : null}
              </div>
            )) : null}
            {day.open ? (
              <div className="flex flex-wrap items-center gap-x-4">
                <AddRange onClick={() => setDays(withDay(days, meta.weekday, (current) => ({
                  ...current,
                  ranges: [...current.ranges, nextRange(current.ranges)],
                })))} />
                <CopyButton onClick={() => setDays(copyRangesToOtherDays(days, meta.weekday))} />
              </div>
            ) : null}
          </div>
        );
      })}
    </WeekFrame>
  );
}

const prototypes = [
  {
    id: "lista",
    kicker: "Opção A",
    title: "Lista por dia",
    text: "Como a disponibilidade do Cal.com: o dia liga e desliga, início e fim são listas de 30 em 30 minutos, e a lista abre perto do horário atual. Dá para somar um intervalo e copiar o dia.",
    pros: ["Poucos toques quando o horário está na tela", "O passo de 30 minutos evita 9h07", "O almoço vira um segundo intervalo, não um relógio"],
    cons: ["Horário longe do atual pede rolagem", "15 minutos deixaria a lista duas vezes maior", "Não serve para digitar 9 e 18 sem olhar a lista"],
    Body: ListPrototype,
  },
  {
    id: "digitar",
    kicker: "Opção B",
    title: "Hora digitável",
    text: "Equivalente ao TimeField do React Aria: hora e minuto são segmentos. Dá para digitar ou subir e descer com as setas (minutos de 15 em 15). O Mantine TimeInput, por baixo, ainda é o relógio nativo do navegador.",
    pros: ["Não abre lista", "Quem já sabe o horário digita direto", "O teclado numérico do celular cabe no fluxo"],
    cons: ["Mais toques que um chip para 9h, 12h e 18h", "É fácil deixar 18 no lugar de 13", "Hora inválida precisa de correção no desfoque"],
    Body: TypedPrototype,
  },
  {
    id: "chips",
    kicker: "Opção C",
    title: "Chips de horário",
    text: "Os horários que mais aparecem na barbearia ficam em botões. Qualquer outro horário usa o mesmo select do restante do app, em passos de 15 minutos.",
    pros: ["A semana típica fecha em 8 toques", "O horário marcado fica óbvio", "Não depende do relógio do navegador"],
    cons: ["Horário fora da fileira volta para a lista", "A fileira ocupa altura no celular", "Muitos chips juntos cansam se o expediente for irregular"],
    Body: ChipsPrototype,
  },
] as const;

export function HoursPrototypes() {
  return (
    <div className="grid gap-8">
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
        Pesquisa de horário de atendimento. A tela de Configurações continua com o campo de hora atual. Passo das listas: {TIME_STEP_MINUTES} minutos. Semana de referência: segunda a sexta, 9h–18h com almoço 12h–13h; sábado 9h–13h.
      </p>
      {prototypes.map((item) => {
        const comparison = HOURS_COMPARISON.find((entry) => entry.id === item.id)!;
        return (
          <section key={item.id} id={item.id} aria-labelledby={`${item.id}-title`} className="grid gap-4">
            <div className="max-w-[65ch]">
              <p className="text-sm font-semibold text-muted">{item.kicker}</p>
              <h2 id={`${item.id}-title`} className="font-display text-xl font-bold tracking-tight">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
            <item.Body />
            <div className="grid gap-3 rounded-card border border-line bg-subtle/60 p-4 text-sm leading-relaxed sm:grid-cols-3">
              <p><span className="font-semibold">A favor. </span>{item.pros.join(" ")}</p>
              <p><span className="font-semibold">Contra. </span>{item.cons.join(" ")}</p>
              <p><span className="font-semibold">Celular. </span>{comparison.tapsNote}</p>
            </div>
          </section>
        );
      })}
      <section aria-labelledby="comparacao-title" className="grid gap-3">
        <h2 id="comparacao-title" className="font-display text-xl font-bold tracking-tight">Comparação</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Toques para montar a semana típica em cada opção</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Opção</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Toques</th>
                <th scope="col" className="py-2 font-semibold">Quando vale</th>
              </tr>
            </thead>
            <tbody>
              {HOURS_COMPARISON.map((item) => (
                <tr key={item.id} className="border-b border-line align-top">
                  <th scope="row" className="py-3 pr-3 font-semibold">{item.title}</th>
                  <td className="py-3 pr-3 tabular-nums">{item.taps}</td>
                  <td className="py-3 text-muted">{item.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {references.map((item) => (
            <li key={item.href}>
              <a className="font-semibold text-ink underline underline-offset-4" href={item.href} target="_blank" rel="noreferrer">{item.label}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
