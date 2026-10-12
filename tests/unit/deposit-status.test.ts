import { describe, expect, it } from "vitest";
import { agendaPixRefundOrigin } from "../../lib/payments/refund-flow";
import { deriveDepositStatus } from "../../lib/contracts/deposit-status";
import { isUndefinedColumn } from "../../lib/postgres-error";

describe("depositStatus", () => {
  const base = {
    depositCents: 1500,
    bookingStatus: "confirmed",
    paymentStatus: "paid",
    refundStatus: null,
    reversalReason: null,
    autoLateRefund: false,
  };

  it("separa sem sinal, pago, devolvido, contestado e estorno tardio do AgendaPix", () => {
    expect(deriveDepositStatus({ ...base, depositCents: 0 })).toBe("none");
    expect(deriveDepositStatus(base)).toBe("paid");
    expect(deriveDepositStatus({ ...base, reversalReason: "refunded", paymentStatus: "refunded" })).toBe("refunded");
    expect(deriveDepositStatus({ ...base, reversalReason: "charged_back", paymentStatus: "refunded" })).toBe("charged_back");
    expect(deriveDepositStatus({ ...base, autoLateRefund: true, paymentStatus: "refunded", refundStatus: "refunded" })).toBe("auto_refunded");
    expect(deriveDepositStatus({ ...base, bookingStatus: "pending_payment", paymentStatus: "pending" })).toBe("none");
  });

  it("não trata o estorno tardio do AgendaPix como devolução do cliente", () => {
    expect(agendaPixRefundOrigin([{ kind: "auto_late", status: "processing" }])).toBe("auto_late");
    expect(agendaPixRefundOrigin([{ kind: "auto_late", status: "failed" }])).toBeNull();
    expect(agendaPixRefundOrigin([{ kind: "owner_api", status: "refunded" }])).toBe("owner");
    expect(agendaPixRefundOrigin([])).toBeNull();
  });

  it("reconhece coluna ausente no erro embrulhado do driver", () => {
    expect(isUndefinedColumn(Object.assign(new Error("query"), { cause: { code: "42703" } }))).toBe(true);
    expect(isUndefinedColumn(Object.assign(new Error("query"), { cause: { code: "23505" } }))).toBe(false);
  });
});
