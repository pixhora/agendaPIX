import { describe, expect, it } from "vitest";
import {
  assessPolicyRequestedOn,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessDay,
  localDate,
  manualRefundDueAt,
  manualRefundDueAtFromNotice,
  manualRefundFlags,
} from "../../lib/payments/manual-refund-calendar";

const notice = new Date("2026-10-17T02:50:00.000Z");

describe("prazo de 7 dias no fuso do negócio", () => {
  it("23:50 em São Paulo ainda é o dia do aviso e vence no fim do 7º dia", () => {
    expect(localDate(notice, "America/Sao_Paulo")).toBe("2026-10-16");
    const due = manualRefundDueAtFromNotice(notice, "America/Sao_Paulo");
    expect(due.toISOString()).toBe("2026-10-24T02:59:59.999Z");
    expect(formatBusinessDay(due, "America/Sao_Paulo", true)).toBe("sex, 23 out");
  });

  it("o mesmo instante em Manaus vence no fim do dia local", () => {
    expect(localDate(notice, "America/Manaus")).toBe("2026-10-16");
    expect(manualRefundDueAt("2026-10-16", "America/Manaus").toISOString()).toBe("2026-10-24T03:59:59.999Z");
  });

  it("formata data e data com hora", () => {
    expect(formatBusinessDate("2026-10-16", "America/Sao_Paulo")).toBe("sex, 16 out");
    expect(formatBusinessDateTime(new Date("2026-10-08T17:02:00.000Z"), "America/Sao_Paulo")).toBe("qui, 8 out, 14:02");
  });

  it("escreve a data por extenso dentro da frase e só põe o ano quando muda", () => {
    const today = "2026-10-08";
    const zone = "America/Sao_Paulo";
    expect(formatBusinessDate("2026-10-09", zone, { style: "sentence", todayLocal: today })).toBe("sexta, 9 de outubro");
    expect(formatBusinessDate("2026-10-15", zone, { style: "sentence", todayLocal: today })).toBe("quinta, 15 de outubro");
    expect(formatBusinessDate("2027-04-06", zone, { style: "sentence", todayLocal: today })).toBe("terça, 6 de abril de 2027");
    expect(formatBusinessDate("2026-10-10", zone, { style: "sentence", todayLocal: today })).toBe("sábado, 10 de outubro");
    expect(formatBusinessDate("2026-10-11", zone, { style: "sentence", todayLocal: today })).toBe("domingo, 11 de outubro");
    expect(formatBusinessDate("2026-02-01", zone, { style: "sentence", todayLocal: "2026-01-31" })).toBe("domingo, 1 de fevereiro");
    expect(formatBusinessDate("2027-01-01", zone, { style: "sentence", todayLocal: "2026-12-31" })).toBe("sexta, 1 de janeiro de 2027");
    expect(formatBusinessDate("2026-10-15", zone, { style: "short", todayLocal: today })).toBe("qui, 15 out");
  });

  it("recusa data inválida, futura ou anterior ao pagamento", () => {
    const base = { todayLocal: "2030-06-01", paidOnLocal: "2030-06-01", timeZone: "America/Sao_Paulo" };
    expect(assessPolicyRequestedOn({ ...base, requestedOn: "01/06/2030" })).toMatchObject({ ok: false, code: "refund_requested_on_invalid" });
    expect(assessPolicyRequestedOn({ ...base, requestedOn: "2030-02-31" })).toMatchObject({ ok: false, code: "refund_requested_on_invalid" });
    expect(assessPolicyRequestedOn({ ...base, requestedOn: "2030-06-02" })).toMatchObject({ ok: false, code: "refund_requested_on_in_future" });
    expect(assessPolicyRequestedOn({ ...base, requestedOn: "2030-05-31" })).toMatchObject({ ok: false, code: "refund_requested_on_before_payment" });
    expect(assessPolicyRequestedOn({ ...base, requestedOn: undefined })).toMatchObject({ ok: true, requestedOn: "2030-06-01" });
  });

  it("marca véspera e atraso sem mudar dinheiro", () => {
    const due = manualRefundDueAt("2026-10-16", "America/Sao_Paulo");
    const eve = new Date("2026-10-22T15:00:00.000Z");
    const after = new Date("2026-10-24T03:00:00.000Z");
    expect(manualRefundFlags({ dueAt: due, open: true, now: eve, timeZone: "America/Sao_Paulo" })).toEqual({
      manualRefundOverdue: false,
      manualRefundDueTomorrow: true,
    });
    expect(manualRefundFlags({ dueAt: due, open: true, now: after, timeZone: "America/Sao_Paulo" }).manualRefundOverdue).toBe(true);
    expect(manualRefundFlags({ dueAt: due, open: false, now: after, timeZone: "America/Sao_Paulo" })).toEqual({
      manualRefundOverdue: false,
      manualRefundDueTomorrow: false,
    });
  });
});
