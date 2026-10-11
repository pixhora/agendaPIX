import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mpFixturesAllowed } from "../../lib/mercadopago/dev-fixtures";
import { copyRangesToOtherDays, emptyWeek, HOURS_COMPARISON, nearestTime, timeOptions } from "../../components/dev/hours-model";
import robots from "../../app/robots";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

describe("protótipo de horários", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("responde 404 em produção com o mesmo guard de /dev/mp-fixtures", async () => {
    expect(mpFixturesAllowed("production")).toBe(false);
    expect(readFileSync("app/dev/mp-fixtures/page.tsx", "utf8")).toContain("mpFixturesAllowed()");
    expect(readFileSync("app/dev/horarios/page.tsx", "utf8")).toContain("mpFixturesAllowed()");
    expect(readFileSync("app/dev/horarios/page.tsx", "utf8")).toContain("notFound()");
    vi.stubEnv("NODE_ENV", "production");
    const { default: Page } = await import("../../app/dev/horarios/page");
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(/404/);
  });

  it("abre fora de produção", () => {
    expect(mpFixturesAllowed("test")).toBe(true);
    expect(mpFixturesAllowed("development")).toBe(true);
  });

  it("entra como Disallow no robots, junto com /api", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules) ? rules.flatMap((rule) => rule.disallow ?? []) : rules?.disallow ?? [];
    const blocked = (Array.isArray(disallow) ? disallow : [disallow]).filter((item): item is string => Boolean(item));
    expect(blocked).toContain("/dev");
    expect(blocked).toContain("/api");
  });

  it("monta a lista de 30 em 30 e copia o dia para os outros", () => {
    expect(timeOptions(30)).toHaveLength(48);
    expect(timeOptions(30)[0]).toBe("00:00");
    expect(timeOptions(30)).toContain("09:00");
    expect(timeOptions(30)).toContain("18:00");
    expect(nearestTime(30, new Date(2026, 9, 11, 9, 10))).toBe("09:00");
    const copied = copyRangesToOtherDays(emptyWeek().map((day, index) => (
      index === 0 ? { ...day, open: true, ranges: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }] } : day
    )), 1);
    expect(copied.filter((day) => day.open)).toHaveLength(7);
    expect(copied.find((day) => day.weekday === 6)?.ranges).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ]);
    expect(HOURS_COMPARISON.map((item) => item.taps)).toEqual([11, 14, 8]);
  });
});
