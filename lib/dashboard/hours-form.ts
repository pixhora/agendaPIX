/** Liga a pausa no expediente. Desligada, cada dia segue com um intervalo só. */
export const MULTI_INTERVAL_HOURS = process.env.NEXT_PUBLIC_MULTI_INTERVAL_HOURS === "true";

export const HOURS_RANGE_LIMIT = 14;

export type HourRange = { weekday: number; opensAt: string; closesAt: string };
export type DayPause = { start: string; end: string };
export type DayDraft = { open: boolean; start: string; end: string; pause: DayPause | null };

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

export function draftsFromHours(hours: HourRange[], multiInterval: boolean): DayDraft[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const ranges = hours
      .filter((hour) => hour.weekday === weekday)
      .map((hour) => ({ opensAt: hour.opensAt.slice(0, 5), closesAt: hour.closesAt.slice(0, 5) }))
      .sort((left, right) => left.opensAt.localeCompare(right.opensAt) || left.closesAt.localeCompare(right.closesAt));
    if (!ranges.length) return { open: false, start: DEFAULT_START, end: DEFAULT_END, pause: null };
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    if (multiInterval && ranges.length === 2 && first.closesAt < ranges[1].opensAt) {
      return { open: true, start: first.opensAt, end: last.closesAt, pause: { start: first.closesAt, end: ranges[1].opensAt } };
    }
    return { open: true, start: first.opensAt, end: last.closesAt, pause: null };
  });
}

export function hoursPayload(days: DayDraft[], multiInterval: boolean): HourRange[] {
  return days.flatMap((day, weekday) => {
    if (!day.open) return [];
    if (multiInterval && day.pause) {
      return [
        { weekday, opensAt: day.start, closesAt: day.pause.start },
        { weekday, opensAt: day.pause.end, closesAt: day.end },
      ];
    }
    return [{ weekday, opensAt: day.start, closesAt: day.end }];
  });
}

export function rangesOverlap(left: Pick<HourRange, "opensAt" | "closesAt">, right: Pick<HourRange, "opensAt" | "closesAt">) {
  return left.opensAt < right.closesAt && right.opensAt < left.closesAt;
}

export function dayError(day: DayDraft, multiInterval: boolean): string | null {
  if (!day.open) return null;
  if (!(day.start < day.end)) return "O fim precisa ser depois do início.";
  if (!multiInterval || !day.pause) return null;
  if (!(day.pause.start < day.pause.end)) return "O fim da pausa precisa ser depois do início.";
  if (!(day.start < day.pause.start && day.pause.end < day.end)) return "A pausa precisa ficar dentro do horário de atendimento.";
  const [morning, afternoon] = hoursPayload([day], true);
  if (morning && afternoon && rangesOverlap(morning, afternoon)) return "A pausa precisa ficar dentro do horário de atendimento.";
  return null;
}

export function hoursError(days: DayDraft[], multiInterval: boolean): string | null {
  const ranges = hoursPayload(days, multiInterval);
  if (ranges.length > HOURS_RANGE_LIMIT) return "Cada dia aceita no máximo uma pausa.";
  for (const day of days) {
    const error = dayError(day, multiInterval);
    if (error) return error;
  }
  return null;
}

export function withPause(day: DayDraft): DayDraft {
  if (!day.open || day.pause) return day;
  return { ...day, pause: { start: "12:00", end: "13:00" } };
}

export function withoutPause(day: DayDraft): DayDraft {
  return { ...day, pause: null };
}
