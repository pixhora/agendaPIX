import { describe, expect, it } from "vitest";
import { handleHttp, HttpError } from "../../lib/http";
import { assertDepositBookable, getDepositBookability, resolveServiceBookability } from "../../lib/bookings/deposit-bookability";

describe("aptidão do sinal", () => {
  it("permite reservar hoje e encaminha um motivo futuro sem criar esse erro", () => {
    expect(getDepositBookability({ id: "negocio" })).toEqual({ ok: true });
    expect(assertDepositBookable({ id: "negocio" })).toBeUndefined();
    expect(resolveServiceBookability({ bookingsPaused: false }, { depositCents: 1000 }, { ok: true })).toEqual({ bookable: true, blockedReason: null });
    expect(resolveServiceBookability({ bookingsPaused: true }, { depositCents: 0 }, { ok: true })).toEqual({ bookable: false, blockedReason: "bookings_paused" });
    expect(resolveServiceBookability({ bookingsPaused: false }, { depositCents: 1000 }, {
      ok: false, status: 409, code: "mp_account_not_connected", message: "Conecte o Mercado Pago para receber o sinal.",
    })).toEqual({ bookable: false, blockedReason: "mp_account_not_connected" });
    expect(resolveServiceBookability({ bookingsPaused: false }, { depositCents: 0 }, {
      ok: false, status: 409, code: "mp_account_not_connected", message: "Conecte o Mercado Pago para receber o sinal.",
    })).toEqual({ bookable: true, blockedReason: null });
  });

  it("publica erros no envelope { error: { code } }", async () => {
    const paused = await handleHttp(async () => { throw new HttpError(403, "bookings_paused", "Este estabelecimento não está aceitando novos agendamentos no momento."); });
    expect(paused.status).toBe(403);
    expect(await paused.json()).toEqual({ error: { code: "bookings_paused", message: "Este estabelecimento não está aceitando novos agendamentos no momento." } });
    const changed = await handleHttp(async () => {
      throw new HttpError(409, "policy_changed", "A política do sinal mudou. Confira e confirme de novo.", undefined, { policyHash: "abc", policySummary: "linha" });
    });
    expect(await changed.json()).toEqual({ error: { code: "policy_changed", message: "A política do sinal mudou. Confira e confirme de novo.", policyHash: "abc", policySummary: "linha" } });
  });
});
