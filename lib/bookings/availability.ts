export type Slot = { startsAt: Date; endsAt: Date };

function formatter(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}
function parts(date: Date, format: Intl.DateTimeFormat) {
  return Object.fromEntries(format.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}
export function localDate(date: Date, timezone: string) {
  const value = parts(date, formatter(timezone));
  return `${value.year}-${value.month}-${value.day}`;
}
function clockSeconds(clock: string) {
  const [hours, minutes, seconds = 0] = clock.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

// Testa os offsets antes e depois da data. Horas inexistentes no horário de verão não geram vagas.
function instants(date: string, seconds: number, format: Intl.DateTimeFormat) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const wall = midnight + seconds * 1000;
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = new Date(wall + delta);
    const value = parts(sample, format);
    offsets.add(Date.parse(`${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}Z`) - sample.getTime());
  }
  return [...offsets].map((offset) => new Date(wall - offset)).filter((candidate) => {
    const value = parts(candidate, format);
    return `${value.year}-${value.month}-${value.day}` === date && clockSeconds(`${value.hour}:${value.minute}:${value.second}`) === seconds;
  });
}

export function availableSlots(input: {
  date: string; timezone: string; durationMinutes: number;
  hours: { opensAt: string; closesAt: string } | null;
  busy: Slot[]; now: Date;
}): Slot[] {
  if (!input.hours) return [];
  const format = formatter(input.timezone);
  const opening = clockSeconds(input.hours.opensAt);
  const closing = clockSeconds(input.hours.closesAt);
  const duration = input.durationMinutes * 60000;
  if (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0) throw new RangeError("Duração inválida.");
  const result: Slot[] = [];
  for (let seconds = opening; seconds + input.durationMinutes * 60 <= closing; seconds += input.durationMinutes * 60) {
    for (const startsAt of instants(input.date, seconds, format)) {
      const endsAt = new Date(startsAt.getTime() + duration);
      const end = parts(endsAt, format);
      const endSeconds = clockSeconds(`${end.hour}:${end.minute}:${end.second}`);
      if (startsAt <= input.now || `${end.year}-${end.month}-${end.day}` !== input.date || endSeconds > closing) continue;
      if (input.busy.some((busy) => startsAt < busy.endsAt && endsAt > busy.startsAt)) continue;
      result.push({ startsAt, endsAt });
    }
  }
  return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
