import { describe, expect, it } from "vitest";
import { refundDeadlineEveNotice, type EveItem } from "../../lib/email/templates/refund-deadline-eve";
import { formatBusinessDate, formatBusinessDateTime, formatBusinessDay, manualRefundDueAt } from "../../lib/payments/manual-refund-calendar";

const tz = "America/Sao_Paulo";

function policyItem(overrides: Partial<EveItem> = {}): EveItem {
  const due = manualRefundDueAt("2026-10-16", tz);
  return {
    kind: "policy",
    customerName: "Ana Souza",
    serviceName: "Design de sobrancelha",
    whenLabel: formatBusinessDateTime(new Date("2026-10-16T18:30:00.000Z"), tz),
    amountLabel: "R$ 20,00",
    dueLabel: formatBusinessDay(due, tz, true),
    dueShort: formatBusinessDay(due, tz, false),
    requestedOnLabel: formatBusinessDate("2026-10-16", tz),
    paidAtLabel: formatBusinessDateTime(new Date("2026-10-08T17:02:00.000Z"), tz),
    bookingPath: "/dashboard/agenda/book-1",
    slotOccupied: false,
    disconnected: false,
    ...overrides,
  };
}

describe("E5 devolução pela política", () => {
  it("usa os literais da spec 08 §4.8 v3.4.1", () => {
    const notice = refundDeadlineEveNotice({ ownerName: "Marina", items: [policyItem()] });
    expect(notice.subject).toBe("Prazo vence amanhã: devolva R$ 20,00 para Ana Souza");
    expect(notice.preheader).toBe("Ana Souza pediu para cancelar dentro da regra. O prazo de 7 dias vence amanhã, sex, 23 out.");
    expect(notice.text).toContain("Oi, Marina,");
    expect(notice.text).toContain("Ana Souza pediu para cancelar dentro da regra do sinal em sex, 16 out. A devolução de R$ 20,00 ainda está pendente, e o prazo de 7 dias para devolver termina amanhã, sex, 23 out.");
    expect(notice.text).toContain("Horário: sex, 16 out, 15:30 (cancelado)");
    expect(notice.text).toContain("Pedido de cancelamento: sex, 16 out");
    expect(notice.text).toContain("Valor a devolver: R$ 20,00");
    expect(notice.text).toContain("Prazo: até sex, 23 out");
    expect(notice.text).toContain("Coloque saldo e toque em \"Devolver agora\"");
    expect(notice.text).toContain("na venda de R$ 20,00 de qui, 8 out, 14:02, e toque em \"Devolvi pelo Mercado Pago\"");
    expect(notice.text).toContain("Este é o último lembrete sobre esta devolução.");
    expect(notice.text).toContain("Devolver agora: /dashboard/agenda/book-1?devolver=1");
    expect(notice.text).not.toContain("Marcar como devolvido");
    expect(notice.text).not.toContain("ou devolva por outro meio");
    expect(notice.html).toContain("<strong>sex, 16 out</strong>");
    expect(notice.html).toContain("<strong>R$ 20,00</strong>");
    expect(notice.html).toContain("<strong>amanhã, sex, 23 out</strong>");
  });

  it("sem conexão some a opção de saldo e o botão abre o agendamento", () => {
    const notice = refundDeadlineEveNotice({ ownerName: "Marina", items: [policyItem({ disconnected: true })] });
    expect(notice.text).not.toContain("Coloque saldo");
    expect(notice.text).not.toContain("Devolver agora");
    expect(notice.text).toContain("Devolvi pelo Mercado Pago");
    expect(notice.text).toContain("Abrir agendamento: /dashboard/agenda/book-1");
    expect(notice.text).not.toContain("?devolver=1");
  });
});
