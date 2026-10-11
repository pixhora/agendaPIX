/** Modelo do protótipo de horários. Não é a tela real de Configurações. */

export const WEEKDAYS = [
  { weekday: 1, label: "Segunda" },
  { weekday: 2, label: "Terça" },
  { weekday: 3, label: "Quarta" },
  { weekday: 4, label: "Quinta" },
  { weekday: 5, label: "Sexta" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
] as const;

export const TIME_STEP_MINUTES = 30;

export const CHIP_TIMES = ["08:00", "09:00", "10:00", "12:00", "13:00", "14:00", "18:00", "19:00"] as const;

export type TimeRange = { start: string; end: string };

export type DaySchedule = {
  weekday: number;
  open: boolean;
  ranges: TimeRange[];
};

export function formatMinutes(total: number): string {
  const day = 24 * 60;
  const clamped = ((total % day) + day) % day;
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeOptions(stepMinutes = TIME_STEP_MINUTES): string[] {
  if (stepMinutes < 1 || (24 * 60) % stepMinutes !== 0) throw new Error("passo inválido");
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) options.push(formatMinutes(minutes));
  return options;
}

/** Horário da lista mais perto de agora, para a lista abrir já nessa faixa. */
export function nearestTime(stepMinutes = TIME_STEP_MINUTES, now = new Date()): string {
  const total = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.round(total / stepMinutes) * stepMinutes;
  const capped = Math.min(Math.max(rounded, 0), 24 * 60 - stepMinutes);
  return formatMinutes(capped);
}

export function emptyWeek(): DaySchedule[] {
  return WEEKDAYS.map((day) => ({
    weekday: day.weekday,
    open: false,
    ranges: [{ start: "09:00", end: "18:00" }],
  }));
}

export function withDay(days: DaySchedule[], weekday: number, patch: (day: DaySchedule) => DaySchedule): DaySchedule[] {
  return days.map((day) => (day.weekday === weekday ? patch(day) : day));
}

/** Novo intervalo começa onde o anterior termina e vai até 18h, se ainda couber. */
export function nextRange(ranges: TimeRange[]): TimeRange {
  const previous = ranges[ranges.length - 1];
  const start = previous?.end && previous.end < "18:00" ? previous.end : "13:00";
  const end = start < "18:00" ? "18:00" : "19:00";
  return { start, end };
}

export function copyRangesToOtherDays(days: DaySchedule[], weekday: number): DaySchedule[] {
  const source = days.find((day) => day.weekday === weekday);
  if (!source) return days;
  const ranges = source.ranges.map((range) => ({ ...range }));
  return days.map((day) => (
    day.weekday === weekday ? day : { ...day, open: true, ranges: ranges.map((range) => ({ ...range })) }
  ));
}

/**
 * Toques no celular para a semana típica, partindo de tudo fechado:
 * seg–sex 9h–18h com almoço 12h–13h, sáb 9h–13h, dom fechado.
 * Um toque é um contato na tela (inclusive tecla do teclado).
 * A lista abre perto do horário atual: se o alvo não estiver visível, some uma rolagem.
 */
export const HOURS_COMPARISON = [
  {
    id: "lista",
    title: "Lista por dia",
    taps: 11,
    tapsNote: "11 toques se cada horário já aparecer na lista. Some 1 rolagem quando o alvo está a mais de umas 2 horas do horário atual.",
    summary: "Interruptor, dois selects e um segundo intervalo. Um toque copia a segunda para os outros dias.",
  },
  {
    id: "digitar",
    title: "Hora digitável",
    taps: 14,
    tapsNote: "14 toques. Cada ajuste de hora é um toque no segmento e dois dígitos; os minutos 00 permanecem.",
    summary: "Campo em segmentos, no espírito do TimeField do React Aria, sem abrir lista.",
  },
  {
    id: "chips",
    title: "Chips de horário",
    taps: 8,
    tapsNote: "8 toques nesta semana, porque 9h, 12h, 13h e 18h estão na fileira. Um horário fora da fileira abre o select e soma 2 toques.",
    summary: "Os horários mais comuns da barbearia ficam à mão. O resto usa o mesmo select do app.",
  },
] as const;
