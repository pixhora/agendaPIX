import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http";
import { MpAccountNotConnectedError } from "../../lib/payments/seller-account";
import { ProviderTimeoutError } from "../../lib/payments/timeout";
import { reconcileFailureCode, wallClockBudget } from "../../lib/payments/reconcile";

describe("código de falha da reconciliação", () => {
  it("não devolve mensagem, e-mail nem token", () => {
    const leaked = new Error("Mercado Pago recusou Bearer super-secret do dono@salao.com");
    expect(reconcileFailureCode(leaked)).toBe("reconcile_failed");
    expect(reconcileFailureCode(leaked)).not.toContain("dono@salao.com");
    expect(reconcileFailureCode(leaked)).not.toContain("Bearer");
    expect(reconcileFailureCode(new MpAccountNotConnectedError())).toBe("mp_account_not_connected");
    expect(reconcileFailureCode(new ProviderTimeoutError(8000))).toBe("provider_timeout");
    expect(reconcileFailureCode(new HttpError(503, "payment_unavailable", "Cobrança indisponível."))).toBe("payment_unavailable");
    const http = new Error("Mercado Pago GET /v1/payments/x → 500: {\"payer\":{\"email\":\"dono@salao.com\"}}");
    http.name = "MercadoPagoHttpError";
    Object.assign(http, { status: 500 });
    expect(reconcileFailureCode(http)).toBe("mercadopago_http_500");
    expect(reconcileFailureCode({ code: "dono@salao.com" })).toBe("reconcile_failed");
    expect(reconcileFailureCode({ code: "cancel_not_settled" })).toBe("cancel_not_settled");
  });
});

describe("orçamento da passagem", () => {
  it("segura tempo para as etapas seguintes quando o relógio já andou", () => {
    const started = 1_000_000;
    const tight = wallClockBudget(50_000, 8_000, started, () => started + 35_000);
    expect(tight.allow("stuck")).toBe(false);
    expect(tight.allow("cancel")).toBe(false);
    expect(tight.allow("poll")).toBe(true);
    expect(tight.allow("reminders")).toBe(true);
    expect(wallClockBudget(50_000, 8_000, started, () => started).allow("stuck")).toBe(true);
  });
});
