import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/dashboard/session", () => ({ ownerContext: async () => ({ owner: { id: "owner-test" }, businesses: [{ id: "business-test", name: "Studio QA" }], business: { id: "business-test", name: "Studio QA", timezone: "America/Sao_Paulo" } }) }));
vi.mock("@/lib/dashboard/data", () => ({ dashboardBookings: async () => [] }));
import AgendaPage from "../../app/dashboard/(owner)/page";
it("semana sem reservas identifica os sete dias vazios", async () => {
  const markup = renderToStaticMarkup(await AgendaPage({ searchParams: Promise.resolve({ date: "2030-01-07", view: "week" }) }));
  expect((markup.match(/Sem atendimentos\./g) ?? [])).toHaveLength(7);
  expect(markup).toContain("Conferir funcionamento");
});
it("dia sem reservas mantém uma mensagem de vazio e ação", async () => {
  const markup = renderToStaticMarkup(await AgendaPage({ searchParams: Promise.resolve({ date: "2030-01-07", view: "day" }) }));
  expect(markup).toContain("Nenhum atendimento neste período");
  expect(markup).not.toContain("Sem atendimentos.");
});
