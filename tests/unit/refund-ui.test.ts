import { describe, expect, it } from "vitest";
import { formatBrlCents } from "../../lib/dashboard/summary";
import {
  confirmLabel,
  customerLine,
  deepLinkGate,
  deepLinkOpensDialog,
  dialogDeadline,
  eveDeadlineLine,
  formatRefundAmount,
  isDueTomorrow,
  refundDueDay,
  mapRefundFailure,
  paidOnLabel,
  asRefundStatus,
  parseRefundPreview,
  policyLine,
  refundListMarks,
  refundRequestBody,
  refundTitle,
  refundWindowLine,
  requestedDateField,
  returnByLine,
  showRefundAction,
} from "../../lib/dashboard/refund-ui";
import { INSUFFICIENT_BALANCE_MESSAGE } from "../../lib/payments/refund-copy";

const preview = {
  eligible: true,
  reason: null,
  amountCents: 2000,
  customer: { name: "Ana Souza", emailMasked: "a***@email.com" },
  policy: { text: "Cancelou com mais de 48 h → devolução total.", refundDeadlineAt: "2026-10-16T02:59:59.999Z" },
  paidAt: "2026-10-08T17:02:00.000Z",
  requestedOn: null,
  todayLocal: "2026-10-08",
  paidOnLocal: "2026-10-08",
  manualRefundDueAt: null,
};

describe("devolução no painel", () => {
  it("formata o sinal com vírgula e nunca mostra R$ 0,00", () => {
    expect(formatRefundAmount(2000)).toBe(formatBrlCents(2000n));
    expect(formatRefundAmount(2000)).toBe("R$\u00a020,00");
    expect(formatRefundAmount(0)).toBeNull();
    expect(formatRefundAmount(-1)).toBeNull();
    expect(formatRefundAmount(10.5)).toBeNull();
  });

  it("monta título, cliente e regra só com o que a prévia trouxe", () => {
    expect(refundTitle("R$\u00a020,00", "Ana Souza")).toBe("Devolver R$\u00a020,00 para Ana Souza?");
    expect(refundTitle(null, "Ana Souza")).toBe("Devolver o sinal para Ana Souza?");
    expect(confirmLabel("R$\u00a020,00")).toBe("Devolver R$\u00a020,00");
    expect(customerLine("Ana Souza", "a***@email.com")).toBe("Ana Souza · a***@email.com");
    expect(policyLine(preview.policy)).toBe("Cancelou com mais de 48 h → devolução total.");
    expect(policyLine(null)).toBeNull();
    expect(policyLine({ text: null, refundDeadlineAt: null })).toBeNull();
    expect(policyLine({ text: "  ", refundDeadlineAt: null })).toBeNull();
  });

  it("soma 7 dias ao pedido e descreve a véspera com a data real", () => {
    expect(returnByLine("2026-10-09", "America/Sao_Paulo")).toBe("Devolva até sex, 16 out.");
    expect(returnByLine("09/10/2026", "America/Sao_Paulo")).toBeNull();
    expect(eveDeadlineLine("sex, 23 out")).toBe("O prazo para devolver vence amanhã (sex, 23 out).");
    expect(paidOnLabel("2026-10-08T17:02:00.000Z", "America/Sao_Paulo")).toBe("qui, 8 out, 14:02");
    expect(refundWindowLine("2026-10-08T17:02:00.000Z", "America/Sao_Paulo")).toBe("Dá para devolver até ter, 6 abr (180 dias).");
    expect(refundWindowLine(null, "America/Sao_Paulo")).toBeNull();
  });

  it("compara o prazo em dias de calendário, inclusive na virada do mês", () => {
    expect(isDueTomorrow("2026-10-09", "2026-10-08")).toBe(true);
    expect(isDueTomorrow("2026-10-15", "2026-10-08")).toBe(false);
    expect(isDueTomorrow("2026-02-01", "2026-01-31")).toBe(true);
    expect(isDueTomorrow("2027-01-01", "2026-12-31")).toBe(true);
    expect(isDueTomorrow("2026-03-01", "2026-02-27")).toBe(false);
    expect(refundDueDay("2026-10-09", "America/Sao_Paulo")).toBe("2026-10-09");
    expect(refundDueDay("2026-10-10T02:59:59.999Z", "America/Sao_Paulo")).toBe("2026-10-09");
    expect(refundDueDay("2026-10-10T02:59:59.999Z", "UTC")).toBe("2026-10-10");
    expect(refundDueDay(null, "America/Sao_Paulo")).toBeNull();
  });

  it("não mostra dois prazos diferentes no mesmo diálogo", () => {
    const eve = dialogDeadline({
      requestedOn: "2026-10-02",
      pickedOn: "2026-10-08",
      todayLocal: "2026-10-08",
      manualRefundDueAt: "2026-10-09",
      timeZone: "America/Sao_Paulo",
    });
    expect(eve).toEqual({ kind: "eve", text: "O prazo para devolver vence amanhã (sex, 9 out)." });
    expect(eve?.text).not.toContain("Devolva até");

    const stored = dialogDeadline({
      requestedOn: "2026-10-02",
      pickedOn: "2026-10-08",
      todayLocal: "2026-10-08",
      manualRefundDueAt: "2026-10-20",
      timeZone: "America/Sao_Paulo",
    });
    expect(stored).toEqual({ kind: "returnBy", text: "Devolva até ter, 20 out." });

    const picking = dialogDeadline({
      requestedOn: null,
      pickedOn: "2026-10-08",
      todayLocal: "2026-10-08",
      manualRefundDueAt: null,
      timeZone: "America/Sao_Paulo",
    });
    expect(picking).toEqual({ kind: "returnBy", text: "Devolva até qui, 15 out." });
    expect(picking?.text).not.toContain("amanhã");
  });

  it("trava a data gravada e limita o picker entre o pagamento e hoje", () => {
    expect(requestedDateField({ ...preview, requestedOn: "2026-10-02" })).toEqual({ readOnly: true, value: "2026-10-02" });
    expect(requestedDateField(preview)).toEqual({ readOnly: false, value: "2026-10-08", min: "2026-10-08", max: "2026-10-08" });
    expect(requestedDateField({ ...preview, paidOnLocal: "2026-10-01", todayLocal: "2026-10-08" })).toEqual({
      readOnly: false,
      value: "2026-10-08",
      min: "2026-10-01",
      max: "2026-10-08",
    });
  });

  it("manda a mensagem da API para o lugar certo", () => {
    expect(mapRefundFailure(409, { error: { code: "refund_amount_changed", message: "O valor do sinal mudou. Atualize a tela e tente de novo." } })).toEqual({
      kind: "reload",
      message: "O valor do sinal mudou. Atualize a tela e tente de novo.",
    });
    expect(mapRefundFailure(409, { error: { code: "not_paid", message: "Este sinal ainda não foi pago." } }).kind).toBe("blocked");
    expect(mapRefundFailure(409, { error: { code: "already_refunded", message: "Este sinal já foi devolvido." } }).kind).toBe("blocked");
    expect(mapRefundFailure(409, { error: { code: "refund_window_expired", message: "O prazo para devolver este sinal pelo AgendaPix já passou." } }).kind).toBe("blocked");
    expect(mapRefundFailure(409, { error: { code: "mp_account_not_connected", message: "Conecte o Mercado Pago ao AgendaPix para devolver o sinal." } }).kind).toBe("blocked");
    expect(mapRefundFailure(422, { error: { code: "refund_requested_on_in_future", message: "A data do pedido não pode ser futura." } })).toEqual({
      kind: "field",
      message: "A data do pedido não pode ser futura.",
    });
    expect(mapRefundFailure(422, { error: { code: "refund_requested_on_before_payment", message: "A data do pedido é anterior ao dia do pagamento do sinal." } }).kind).toBe("field");
    expect(mapRefundFailure(422, { error: { code: "refund_requested_on_invalid", message: "Informe a data do pedido no formato AAAA-MM-DD." } }).kind).toBe("field");
    expect(mapRefundFailure(502, { error: { code: "refund_failed", message: INSUFFICIENT_BALANCE_MESSAGE } })).toEqual({
      kind: "retry",
      message: INSUFFICIENT_BALANCE_MESSAGE,
    });
    expect(mapRefundFailure(502, { error: { code: "refund_failed", message: "Não foi possível devolver o sinal pelo AgendaPix. Tente de novo." } }).kind).toBe("retry");
    expect(mapRefundFailure(500, { error: { code: "internal_error", message: "Não foi possível concluir. Tente novamente." } }).kind).toBe("alert");
  });

  it("omite a data no tentar de novo e no campo só leitura", () => {
    expect(refundRequestBody({ expectedAmountCents: 2000, requestedOn: "2026-10-08", sendDate: true })).toEqual({
      confirm: true,
      expectedAmountCents: 2000,
      requestedOn: "2026-10-08",
    });
    expect(refundRequestBody({ expectedAmountCents: 2000, requestedOn: "2026-10-08", sendDate: false })).toEqual({
      confirm: true,
      expectedAmountCents: 2000,
    });
    expect(refundRequestBody({ expectedAmountCents: 2000, requestedOn: null, sendDate: true })).toEqual({
      confirm: true,
      expectedAmountCents: 2000,
    });
  });

  it("abre o deep link só se a reserva for elegível e esconde o botão quando já devolveu", () => {
    expect(deepLinkOpensDialog(preview)).toBe(true);
    expect(deepLinkGate(preview)).toBe("dialog");
    expect(deepLinkGate({ eligible: false, reason: "mp_account_not_connected" })).toBe("disconnected");
    expect(deepLinkOpensDialog({ eligible: false })).toBe(false);
    expect(deepLinkGate({ eligible: false, reason: "refund_window_expired" })).toBe("blocked");
    expect(showRefundAction({ depositCents: 2000, status: "confirmed", refundStatus: null })).toBe(true);
    expect(showRefundAction({ depositCents: 2000, status: "cancelled", refundStatus: "failed" })).toBe(true);
    expect(showRefundAction({ depositCents: 2000, status: "pending_payment", refundStatus: null })).toBe(false);
    expect(showRefundAction({ depositCents: 0, status: "confirmed", refundStatus: null })).toBe(false);
    expect(showRefundAction({ depositCents: 2000, status: "confirmed", refundStatus: "refunded" })).toBe(false);
    expect(showRefundAction({ depositCents: 2000, status: "confirmed", refundStatus: "in_process" })).toBe(false);
    expect(refundListMarks({ refundStatus: null, manualRefundDueTomorrow: true })).toEqual({
      pending: true, eve: true, inProcess: false, refunded: false,
    });
    expect(refundListMarks({ refundStatus: "in_process", manualRefundDueTomorrow: true }).inProcess).toBe(true);
    expect(refundListMarks({ refundStatus: "in_process", manualRefundDueTomorrow: true }).eve).toBe(false);
    expect(refundListMarks({ refundStatus: "refunded", manualRefundDueTomorrow: false }).refunded).toBe(true);
  });

  it("aceita a prévia do contrato, inclusive política nula", () => {
    expect(parseRefundPreview(preview)?.amountCents).toBe(2000);
    expect(parseRefundPreview({ ...preview, policy: null, reason: "mp_account_not_connected", eligible: false })?.policy).toBeNull();
    expect(parseRefundPreview({ eligible: true })).toBeNull();
    expect(asRefundStatus("failed")).toBe("failed");
    expect(asRefundStatus("outro")).toBeNull();
  });
});
