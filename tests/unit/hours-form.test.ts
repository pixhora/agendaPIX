import { describe, expect, it } from "vitest";
import { hoursSchema } from "../../lib/dashboard/validation";
import {
  HOURS_RANGE_LIMIT,
  dayError,
  draftsFromHours,
  hoursError,
  hoursPayload,
  rangesOverlap,
  setDayOpen,
  withPause,
  withoutPause,
  type DayDraft,
} from "../../lib/dashboard/hours-form";

function week(open = true): DayDraft[] {
  return Array.from({ length: 7 }, () => ({ open, start: "09:00", end: "18:00", pause: null }));
}

describe("horários com pausa", () => {
  it("sem a flag manda um intervalo por dia e ignora pausa", () => {
    const days = week();
    days[1] = withPause(days[1]);
    const payload = hoursPayload(days, false);
    expect(payload).toHaveLength(7);
    expect(new Set(payload.map((day) => day.weekday)).size).toBe(7);
    expect(payload.find((day) => day.weekday === 1)).toEqual({ weekday: 1, opensAt: "09:00", closesAt: "18:00" });
    expect(hoursSchema.safeParse(payload).success).toBe(true);
    expect(hoursPayload(days, false).some((day) => day.opensAt === "12:00")).toBe(false);
  });

  it("com a flag a pausa vira dois intervalos do mesmo dia, até 14", () => {
    const days = week().map(withPause);
    const payload = hoursPayload(days, true);
    expect(payload).toHaveLength(HOURS_RANGE_LIMIT);
    expect(payload.filter((day) => day.weekday === 1)).toEqual([
      { weekday: 1, opensAt: "09:00", closesAt: "12:00" },
      { weekday: 1, opensAt: "13:00", closesAt: "18:00" },
    ]);
    expect(rangesOverlap(payload[0], payload[1])).toBe(false);
    expect(hoursError(days, true)).toBeNull();
  });

  it("o contrato atual rejeita o dia repetido que a pausa produz", () => {
    const days = week(false);
    days[1] = withPause({ ...days[1], open: true });
    const payload = hoursPayload(days, true);
    const parsed = hoursSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.message === "Dia repetido.")).toBe(true);
  });

  it("bloqueia pausa fora do expediente, invertida ou sobreposta", () => {
    const outside = { open: true, start: "09:00", end: "18:00", pause: { start: "08:00", end: "10:00" } };
    const inverted = { open: true, start: "09:00", end: "18:00", pause: { start: "15:00", end: "13:00" } };
    const crossed = { open: true, start: "18:00", end: "09:00", pause: null };
    expect(dayError(outside, true)).toBe("A pausa precisa ficar dentro do horário de atendimento.");
    expect(dayError(inverted, true)).toBe("O fim da pausa precisa ser depois do início.");
    expect(dayError(crossed, true)).toBe("O fim precisa ser depois do início.");
    expect(hoursError([outside, ...week(false).slice(1)], true)).toBe("A pausa precisa ficar dentro do horário de atendimento.");
  });

  it("religar devolve os mesmos horários e a pausa, e o dia fechado não vai no envio", () => {
    const open = { open: true, start: "10:00", end: "19:00", pause: { start: "13:00", end: "14:30" } };
    const closed = setDayOpen(open, false);
    expect(closed).toEqual({ ...open, open: false });
    expect(hoursPayload([closed], true)).toEqual([]);
    expect(hoursPayload([closed], false)).toEqual([]);
    const again = setDayOpen(closed, true);
    expect(again).toEqual(open);
    expect(hoursPayload([again], true)).toEqual([
      { weekday: 0, opensAt: "10:00", closesAt: "13:00" },
      { weekday: 0, opensAt: "14:30", closesAt: "19:00" },
    ]);
    expect(hoursPayload([again], false)).toEqual([{ weekday: 0, opensAt: "10:00", closesAt: "19:00" }]);
  });

  it("reconstrói a pausa só quando a flag está ligada", () => {
    const hours = [
      { weekday: 1, opensAt: "09:00", closesAt: "12:00" },
      { weekday: 1, opensAt: "14:00", closesAt: "18:00" },
    ];
    expect(draftsFromHours(hours, false)[1]).toEqual({ open: true, start: "09:00", end: "18:00", pause: null });
    expect(draftsFromHours(hours, true)[1].pause).toEqual({ start: "12:00", end: "14:00" });
    expect(withoutPause(draftsFromHours(hours, true)[1]).pause).toBeNull();
  });
});
