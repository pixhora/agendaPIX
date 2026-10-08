type ZonedDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedDateTime(date: Date, timeZone: string): ZonedDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute"), second: read("second") };
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedDateTime(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Soma meses de calendário no fuso do negócio, preservando o horário local. Dia 31 cai no último dia do mês. */
export function addCalendarMonths(date: Date, months: number, timeZone: string) {
  const parts = zonedDateTime(date, timeZone);
  const index = parts.month - 1 + months;
  const year = parts.year + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(parts.day, lastDay);
  const guess = new Date(Date.UTC(year, month, day, parts.hour, parts.minute, parts.second));
  return new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
}
