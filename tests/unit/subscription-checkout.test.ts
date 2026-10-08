import { describe, expect, it } from "vitest";
import {
  CHECKOUT_BLOCK_AFTER_MS,
  SUBSCRIPTION_ACTIVE_TOAST,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  absentCheckout,
  parseCheckout,
  pausedSubscriptionCta,
  pendingActivationCopy,
  subscriptionActivatedToast,
  subscriptionCheckoutAction,
} from "../../lib/billing/checkout";

const now = new Date("2026-10-08T15:00:00.000Z");
const available = { available: true, unavailableReason: null, activationHours: null, pendingRequest: null };
const pending = { ...available, activationHours: 6, pendingRequest: { status: "received" } };

function at(offsetMs: number) {
  return new Date(now.getTime() + offsetMs).toISOString();
}

describe("checkout da assinatura", () => {
  it("trata checkout ausente como indisponível", () => {
    expect(parseCheckout(undefined)).toEqual(absentCheckout());
    expect(parseCheckout(null)).toEqual(absentCheckout());
    expect(parseCheckout("sim")).toEqual(absentCheckout());
    expect(parseCheckout({})).toEqual(absentCheckout());
    expect(parseCheckout({ available: "sim" })).toEqual(absentCheckout());
  });

  it("aceita o objeto parcial e descarta prazo ou pedido inválidos", () => {
    expect(parseCheckout({ available: true })).toEqual(available);
    expect(parseCheckout({
      available: false,
      unavailableReason: "fora",
      activationHours: 6.5,
      pendingRequest: [],
      extra: true,
    })).toEqual({ available: false, unavailableReason: "fora", activationHours: null, pendingRequest: null });
    expect(parseCheckout({
      available: true,
      unavailableReason: null,
      activationHours: 6,
      pendingRequest: { status: "received", id: "abc" },
    }).pendingRequest).toEqual({ status: "received", id: "abc" });
  });

  it("escolhe os quatro estados do teste pausado", () => {
    expect(pausedSubscriptionCta({ checkout: available, subscription: null }, now)).toEqual({ kind: "subscribe" });
    expect(pausedSubscriptionCta({ checkout: pending, subscription: null }, now)).toEqual({ kind: "pending", activationHours: 6, allowResend: true });
    expect(pausedSubscriptionCta({ checkout: { ...pending, activationHours: null }, subscription: null }, now).kind).toBe("pending");
    expect(pausedSubscriptionCta({ checkout: absentCheckout(), subscription: null }, now)).toEqual({ kind: "unavailable" });
    expect(pausedSubscriptionCta({
      checkout: available,
      subscription: { status: "active", currentPeriodEnd: at(CHECKOUT_BLOCK_AFTER_MS + 1) },
    }, now)).toEqual({ kind: "blocked" });
  });

  it("no limite de 3 dias o botão continua; depois disso some", () => {
    const active = (currentPeriodEnd: string) => ({ status: "active", currentPeriodEnd });
    expect(pausedSubscriptionCta({ checkout: available, subscription: active(at(CHECKOUT_BLOCK_AFTER_MS)) }, now).kind).toBe("subscribe");
    expect(pausedSubscriptionCta({ checkout: available, subscription: active(at(CHECKOUT_BLOCK_AFTER_MS - 1)) }, now).kind).toBe("subscribe");
    expect(pausedSubscriptionCta({ checkout: available, subscription: active(at(CHECKOUT_BLOCK_AFTER_MS + 1)) }, now).kind).toBe("blocked");
    expect(pausedSubscriptionCta({ checkout: available, subscription: { status: "trialing", currentPeriodEnd: at(CHECKOUT_BLOCK_AFTER_MS + 1) } }, now).kind).toBe("subscribe");
    expect(pausedSubscriptionCta({ checkout: available, subscription: { status: "active", currentPeriodEnd: null } }, now).kind).toBe("subscribe");
    expect(pausedSubscriptionCta({ checkout: pending, subscription: active(at(CHECKOUT_BLOCK_AFTER_MS + 1)) }, now)).toMatchObject({ kind: "pending", allowResend: false });
  });

  it("monta a frase do pedido sem inventar prazo e aponta o POST para a rota do contrato", () => {
    expect(pendingActivationCopy(6)).toBe("Recebemos seu pedido. Ativamos em até 6 h.");
    expect(pendingActivationCopy(null)).toBe("Recebemos seu pedido.");
    expect(SUBSCRIPTION_UNAVAILABLE_COPY).toBe("A assinatura está temporariamente indisponível. Tente de novo mais tarde.");
    const id = "4eeb8372-55cd-4d11-910e-62d4e4374011";
    expect(subscriptionCheckoutAction(id)).toBe(`/api/businesses/${id}/subscription/checkout`);
    expect(subscriptionCheckoutAction("salao")).toBeNull();
    expect(JSON.stringify({ pendingActivationCopy: pendingActivationCopy(6), SUBSCRIPTION_UNAVAILABLE_COPY })).not.toMatch(/wa\.me|5514997504655/);
  });

  it("avisa a assinatura ativa uma vez, só depois do pedido", () => {
    expect(subscriptionActivatedToast(true, false, true)).toBe(SUBSCRIPTION_ACTIVE_TOAST);
    expect(subscriptionActivatedToast(true, true, true)).toBeNull();
    expect(subscriptionActivatedToast(false, false, true)).toBeNull();
    expect(subscriptionActivatedToast(true, false, false)).toBeNull();
  });
});
