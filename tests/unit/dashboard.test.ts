import { describe, expect, it, vi, beforeEach } from "vitest";
import { dateSchema, hoursSchema, parseMoney, serviceFormSchema, weekDates } from "../../lib/dashboard/validation";

const mocks = vi.hoisted(() => ({ findOwnedBusiness: vi.fn(), session: vi.fn(), redirect: vi.fn(), db: { select: vi.fn(), update: vi.fn(), insert: vi.fn(), transaction: vi.fn() } }));
vi.mock("../../lib/tenancy", () => ({ findOwnedBusiness: mocks.findOwnedBusiness }));
vi.mock("../../db", () => ({ getDb: () => mocks.db }));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { dashboardBookings, dashboardCustomers, dashboardHours, dashboardServices, saveDashboardHours, saveDashboardService } from "../../lib/dashboard/data";
import { requireOwner } from "../../lib/dashboard/session";

const businessId = "4eeb8372-55cd-4d11-910e-62d4e4374011";
const service = { businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000, active: true };
beforeEach(() => vi.clearAllMocks());
describe("validação do painel", () => {
  it.each([["29,90", 2990], ["29.9", 2990], ["0", 0], ["21474836.47", 2147483647]])("converte %s sem perder centavos", (text, cents) => expect(parseMoney(text)).toBe(cents));
  it.each(["-1", "1.001", "1e3", "", "NaN", "21474836.48"])("rejeita dinheiro inválido %s", (text) => expect(() => parseMoney(text)).toThrow());
  it("rejeita sinal maior que preço e campos fornecidos pelo cliente", () => {
    expect(serviceFormSchema.safeParse({ ...service, depositCents: 5001 }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...service, ownerId: "outro-dono" }).success).toBe(false);
  });
  it("rejeita dia repetido e intervalo invertido", () => {
    const day = { weekday: 1, opensAt: "09:00", closesAt: "18:00" };
    expect(hoursSchema.safeParse([day, day]).success).toBe(false);
    expect(hoursSchema.safeParse([{ ...day, closesAt: "08:00" }]).success).toBe(false);
    expect(hoursSchema.parse([])).toEqual([]);
  });
  it("semana começa na segunda e cruza o ano", () => {
    expect(weekDates("2026-01-04")).toEqual(["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
  });
});
describe("autorização do painel", () => {
  it("redireciona usuário sem sessão antes de consultar dados", async () => {
    mocks.session.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    await expect(requireOwner()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/login");
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it.each([
    () => dashboardBookings("owner-a", businessId, ["2026-10-02"]),
    () => dashboardCustomers("owner-a", businessId),
    () => dashboardServices("owner-a", businessId),
    () => dashboardHours("owner-a", businessId),
    () => saveDashboardService("owner-a", service),
    () => saveDashboardHours("owner-a", businessId, []),
  ])("nega negócio alheio antes de ler ou gravar seus dados (%#)", async (run) => {
    mocks.findOwnedBusiness.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(mocks.findOwnedBusiness).toHaveBeenCalledWith(businessId, "owner-a", mocks.db);
    expect(mocks.db.select).not.toHaveBeenCalled(); expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled(); expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});
