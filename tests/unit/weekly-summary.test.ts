import { describe, expect, it, vi } from "vitest";
import { runWeeklySummaries, weeklySummaryKind, type WeeklySummaryPorts, type WeeklySummaryRow } from "../../lib/dashboard/weekly-summary";
import { weekLabel, weeklySummaryEmail } from "../../lib/email/templates/weekly-summary";

const row = (overrides: Partial<WeeklySummaryRow> = {}): WeeklySummaryRow => ({
  businessId: "b1", businessName: "Studio Bella", ownerName: "Ana Souza", ownerEmail: "ana@example.com",
  weekStart: "2026-10-05", bookings: 23, depositCents: 46000, newCustomers: 5, nextWeekBookings: 8, ...overrides,
});

function ports(rows: WeeklySummaryRow[], overrides: Partial<WeeklySummaryPorts> = {}) {
  const claimed = new Set<string>();
  const base: WeeklySummaryPorts = {
    load: async () => rows,
    claim: vi.fn(async (businessId, kind) => {
      const key = `${businessId}:${kind}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }),
    record: vi.fn(async () => undefined),
    release: vi.fn(async (businessId, kind) => { claimed.delete(`${businessId}:${kind}`); }),
    send: vi.fn(async () => undefined),
    dashboardHref: (id) => `https://www.agendapix.dev.br/dashboard?businessId=${id}`,
  };
  return { ...base, ...overrides };
}

describe("texto do resumo semanal", () => {
  it("rótulo da semana no mesmo mês e virando o mês", () => {
    expect(weekLabel("2026-10-05")).toBe("5 a 11 de outubro");
    expect(weekLabel("2026-09-28")).toBe("28 de setembro a 4 de outubro");
  });

  it("mostra atendimentos, sinais, clientes novos e a próxima semana", () => {
    const mail = weeklySummaryEmail({ ...row(), dashboardHref: "https://x/dashboard" });
    expect(mail.subject).toBe("Sua semana: R$ 460,00 em sinais pelo Pix");
    expect(mail.text).toContain("Olá, Ana!");
    expect(mail.text).toContain("Resumo de Studio Bella, semana de 5 a 11 de outubro:");
    expect(mail.text).toContain("- 23 atendimentos confirmados");
    expect(mail.text).toContain("- R$ 460,00 em sinais recebidos pelo Pix");
    expect(mail.text).toContain("- 5 clientes novos");
    expect(mail.text).toContain("Semana que vem: 8 horários já confirmados.");
    expect(mail.text).toContain("Abrir agenda: https://x/dashboard");
  });

  it("singular, sem sinal e semana seguinte vazia", () => {
    const mail = weeklySummaryEmail({ ...row({ bookings: 1, depositCents: 0, newCustomers: 0, nextWeekBookings: 0, ownerName: null }), dashboardHref: "h" });
    expect(mail.subject).toBe("Sua semana no AgendaPix: 1 atendimento");
    expect(mail.text).toContain("Olá!");
    expect(mail.text).toContain("- 1 atendimento confirmado");
    expect(mail.text).not.toContain("sinais");
    expect(mail.text).not.toContain("clientes novos");
    expect(mail.text).toContain("Semana que vem ainda está livre.");
  });

  it("escapa o nome do negócio no HTML", () => {
    const mail = weeklySummaryEmail({ ...row({ businessName: "Bella <b>&</b>" }), dashboardHref: "h" });
    expect(mail.html).toContain("Bella &lt;b&gt;&amp;&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>&</b>");
  });
});

describe("envio do resumo semanal", () => {
  it("envia um por negócio com atividade, pula semana vazia e não repete", async () => {
    const p = ports([row(), row({ businessId: "b2", bookings: 0, nextWeekBookings: 0 }), row({ businessId: "b3", bookings: 0, nextWeekBookings: 2 })]);
    expect(await runWeeklySummaries(p)).toEqual({ weeklySummaries: { candidates: 2, sent: 2, skipped: 0, failed: 0 } });
    expect(p.send).toHaveBeenCalledTimes(2);
    expect(p.record).toHaveBeenCalledWith("b1", weeklySummaryKind("2026-10-05"));
    expect(await runWeeklySummaries(p)).toEqual({ weeklySummaries: { candidates: 2, sent: 0, skipped: 2, failed: 0 } });
    expect(p.send).toHaveBeenCalledTimes(2);
  });

  it("falha de e-mail libera a trava para a próxima tentativa", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp down")).mockResolvedValue(undefined);
    const p = ports([row()], { send });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await runWeeklySummaries(p)).weeklySummaries).toMatchObject({ sent: 0, failed: 1 });
    expect(p.release).toHaveBeenCalledWith("b1", "weekly_summary:2026-10-05");
    expect(p.record).not.toHaveBeenCalled();
    expect((await runWeeklySummaries(p)).weeklySummaries).toMatchObject({ sent: 1, failed: 0 });
  });
});
