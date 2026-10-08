import { describe, expect, it } from "vitest";
import { BASE_PLAN } from "../../lib/billing/status";
import { renewCtaLabel, subscribeCtaLabel } from "../../lib/dashboard/trial-notice";
import {
  SUBSCRIPTION_ACTIVE_TOAST,
  SUBSCRIPTION_MANUAL_ACTIVATION_HOURS,
  SUBSCRIPTION_ALREADY_ACTIVE_CODE,
  SUBSCRIPTION_ALREADY_ACTIVE_COPY,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  absentCheckout,
  businessCalendarDaysUntil,
  parseCheckout,
  pendingRequestCopy,
  receivedWhenPhrase,
  renewalDueCopy,
  subscribeHelpCopy,
  subscriptionActivatedToast,
  subscriptionCheckoutAction,
  subscriptionCta,
  subscriptionRaceMessage,
  type SubscriptionCheckout,
} from "../../lib/billing/checkout";

const zone = "America/Sao_Paulo";
const today = new Date("2026-10-09T01:00:00.000Z");
const requestedToday = "2026-10-08T23:10:00.000Z";
const available: SubscriptionCheckout = { available: true, unavailableReason: null, activationHours: 6, pendingRequest: null };

function active(currentPeriodEnd: string) {
  return { status: "active", currentPeriodEnd };
}

describe("checkout da assinatura", () => {
  it("trata checkout ausente como indisponível", () => {
    expect(parseCheckout(undefined)).toEqual(absentCheckout());
    expect(parseCheckout(null)).toEqual(absentCheckout());
    expect(parseCheckout("sim")).toEqual(absentCheckout());
    expect(parseCheckout({})).toEqual(absentCheckout());
    expect(parseCheckout({ available: "sim" })).toEqual(absentCheckout());
  });

  it("aceita o pedido com requestedAt e descarta prazo inválido", () => {
    expect(parseCheckout({ available: true, activationHours: 6, pendingRequest: { requestedAt: requestedToday } }).pendingRequest).toEqual({ requestedAt: requestedToday });
    expect(parseCheckout({ available: false, unavailableReason: "config_missing", activationHours: 6.5, pendingRequest: [] })).toEqual({
      available: false,
      unavailableReason: "config_missing",
      activationHours: null,
      pendingRequest: null,
    });
  });

  it("escolhe assinar, pedido, indisponível e renovar", () => {
    expect(subscriptionCta({ checkout: available, subscription: null }, today, zone)).toEqual({ kind: "subscribe", activationHours: 6 });
    expect(subscriptionCta({
      checkout: { ...available, pendingRequest: { requestedAt: requestedToday } },
      subscription: null,
    }, today, zone)).toEqual({ kind: "pending", activationHours: 6, requestedAt: requestedToday, allowResend: true });
    expect(subscriptionCta({
      checkout: { ...available, activationHours: null, pendingRequest: { requestedAt: requestedToday } },
      subscription: null,
    }, today, zone)).toMatchObject({ kind: "pending", allowResend: false });
    expect(subscriptionCta({ checkout: absentCheckout(), subscription: null }, today, zone)).toEqual({ kind: "unavailable" });
    expect(subscriptionCta({
      checkout: { ...available, unavailableReason: "config_missing" },
      subscription: null,
    }, today, zone)).toEqual({ kind: "unavailable" });
    expect(subscriptionCta({
      checkout: available,
      subscription: active("2026-10-16T02:59:59.000Z"),
    }, new Date("2026-10-12T15:00:00.000Z"), zone).kind).toBe("renew");
  });

  it("mostra renovar em 3 dias corridos e esconde em 4, no fuso do negócio", () => {
    const now = new Date("2026-10-09T01:00:00.000Z");
    expect(businessCalendarDaysUntil(new Date("2026-10-12T02:00:00.000Z"), now, zone)).toBe(3);
    expect(businessCalendarDaysUntil(new Date("2026-10-12T04:00:00.000Z"), now, zone)).toBe(4);
    expect(subscriptionCta({ checkout: available, subscription: active("2026-10-12T02:00:00.000Z") }, now, zone).kind).toBe("renew");
    expect(subscriptionCta({ checkout: available, subscription: active("2026-10-12T04:00:00.000Z") }, now, zone).kind).toBe("blocked");
    expect(subscriptionCta({ checkout: available, subscription: { status: "trialing", currentPeriodEnd: "2026-10-20T02:59:59.000Z" } }, now, zone).kind).toBe("subscribe");
  });

  it("escreve o pedido de hoje, de outro dia e sem prazo", () => {
    expect(receivedWhenPhrase(requestedToday, today, zone)).toBe("hoje às 20:10");
    expect(receivedWhenPhrase(requestedToday, new Date("2026-10-09T15:00:00.000Z"), zone)).toBe("em 8 de outubro, às 20:10");
    expect(receivedWhenPhrase("2026-10-09T02:30:00.000Z", new Date("2026-10-09T03:10:00.000Z"), zone)).toBe("em 8 de outubro, às 23:30");
    expect(pendingRequestCopy("hoje às 20:10", 6)).toBe("Recebemos seu pedido hoje às 20:10. Ativamos em até 6 h, e seus agendamentos online voltam sozinhos.");
    expect(pendingRequestCopy("em 8 de outubro, às 20:10", 6)).toBe("Recebemos seu pedido em 8 de outubro, às 20:10. Ativamos em até 6 h, e seus agendamentos online voltam sozinhos.");
    expect(pendingRequestCopy("hoje às 20:10", null)).toBe("Recebemos seu pedido hoje às 20:10. Seus agendamentos online voltam assim que a assinatura for ativada.");
  });

  it("escreve a ajuda de assinar, o vencimento e o preço a partir do plano", () => {
    expect(subscribeHelpCopy(6)).toBe("Abre o WhatsApp com o pedido pronto. Ativamos em até 6 h.");
    expect(subscribeHelpCopy(null)).toBe("Abre o WhatsApp com o pedido pronto.");
    expect(renewalDueCopy("2026-10-16T02:59:59.000Z", zone)).toBe("Sua assinatura vence em quinta, 15 de outubro.");
    expect(SUBSCRIPTION_MANUAL_ACTIVATION_HOURS).toBe(2);
    expect(subscribeCtaLabel(BASE_PLAN.priceCents)).toBe("Assinar por R$ 49/mês");
    expect(renewCtaLabel(BASE_PLAN.priceCents)).toBe("Renovar por R$ 49/mês");
    expect(SUBSCRIPTION_UNAVAILABLE_COPY).toBe("A assinatura está indisponível no momento. Tente de novo mais tarde.");
    expect(subscriptionRaceMessage(`{"error":{"code":"${SUBSCRIPTION_ALREADY_ACTIVE_CODE}"}}`)).toBe(SUBSCRIPTION_ALREADY_ACTIVE_COPY);
    expect(subscriptionRaceMessage("ok")).toBeNull();
    const id = "4eeb8372-55cd-4d11-910e-62d4e4374011";
    expect(subscriptionCheckoutAction(id)).toBe(`/api/businesses/${id}/subscription/checkout`);
    expect(JSON.stringify(pendingRequestCopy("hoje às 20:10", 6))).not.toMatch(/wa\.me|5514997504655/);
  });

  it("avisa a assinatura ativa uma vez, só depois do pedido", () => {
    expect(subscriptionActivatedToast(true, false, true)).toBe(SUBSCRIPTION_ACTIVE_TOAST);
    expect(subscriptionActivatedToast(true, true, true)).toBeNull();
    expect(subscriptionActivatedToast(false, false, true)).toBeNull();
  });
});
