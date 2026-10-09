import { describe, expect, it } from "vitest";
import { renewCtaLabel, subscribeCtaLabel } from "../../lib/dashboard/trial-notice";
import {
  SUBSCRIPTION_ACTIVE_TOAST,
  SUBSCRIPTION_ALREADY_ACTIVE_COPY,
  SUBSCRIPTION_MANUAL_ACTIVATION_HOURS,
  SUBSCRIPTION_OPEN_FAILED_COPY,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  businessCalendarDaysUntil,
  pendingRequestCopy,
  receivedWhenPhrase,
  renewalDueCopy,
  subscribeHelpCopy,
  subscriptionActivatedToast,
  subscriptionCheckoutAction,
  subscriptionCta,
  subscriptionPostEffect,
  unavailableCheckout,
  type BillingCheckout,
} from "../../lib/dashboard/subscription-ui";

const zone = "America/Sao_Paulo";
const today = new Date("2026-10-09T01:00:00.000Z");
const requestedToday = "2026-10-08T23:10:00.000Z";
const requestId = "6f1c2a40-7b52-4a1e-9c33-0d5e8a7b1c24";
const planPriceCents = 4900;
const available: BillingCheckout = { provider: "manual", available: true, unavailableReason: null, activationHours: 6, pendingRequest: null };

function active(currentPeriodEnd: string) {
  return { status: "active", currentPeriodEnd };
}

function errorBody(code: string, message: string) {
  return JSON.stringify({ error: { code, message } });
}

describe("checkout da assinatura", () => {
  it("escolhe assinar, pedido, indisponível e renovar", () => {
    expect(subscriptionCta({ checkout: available, subscription: null }, today, zone)).toEqual({ kind: "subscribe", activationHours: 6 });
    expect(subscriptionCta({
      checkout: { ...available, pendingRequest: { id: requestId, requestedAt: requestedToday } },
      subscription: null,
    }, today, zone)).toEqual({ kind: "pending", activationHours: 6, requestedAt: requestedToday, allowResend: true });
    expect(subscriptionCta({
      checkout: { ...available, activationHours: null, pendingRequest: { id: requestId, requestedAt: requestedToday } },
      subscription: null,
    }, today, zone)).toMatchObject({ kind: "pending", allowResend: false });
    expect(subscriptionCta({ checkout: unavailableCheckout(), subscription: null }, today, zone)).toEqual({ kind: "unavailable" });
    expect(subscriptionCta({
      checkout: available,
      subscription: active("2026-10-16T02:59:59.000Z"),
    }, new Date("2026-10-12T15:00:00.000Z"), zone).kind).toBe("renew");
  });

  it("mantém o pedido sem prazo quando o checkout já está indisponível", () => {
    const checkout: BillingCheckout = {
      provider: "manual",
      available: false,
      unavailableReason: "config_missing",
      activationHours: null,
      pendingRequest: { id: requestId, requestedAt: requestedToday },
    };
    const cta = subscriptionCta({ checkout, subscription: null }, today, zone);
    expect(cta).toEqual({ kind: "pending", activationHours: null, requestedAt: requestedToday, allowResend: false });
    expect(cta.kind).not.toBe("unavailable");
    if (cta.kind !== "pending") return;
    const when = receivedWhenPhrase(cta.requestedAt, today, zone);
    expect(when).toBe("hoje às 20:10");
    expect(pendingRequestCopy(when ?? "", cta.activationHours)).toBe("Recebemos seu pedido hoje às 20:10. Seus agendamentos online voltam assim que a assinatura for ativada.");
    expect(pendingRequestCopy(when ?? "", cta.activationHours)).not.toBe("Recebemos seu pedido. Ativamos em até 2 h.");
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
    expect(pendingRequestCopy("hoje às 20:10", 6)).toBe("Recebemos seu pedido hoje às 20:10. Ativamos em até 6 horas, e seus agendamentos online voltam sozinhos.");
    expect(pendingRequestCopy("em 8 de outubro, às 20:10", 6)).toBe("Recebemos seu pedido em 8 de outubro, às 20:10. Ativamos em até 6 horas, e seus agendamentos online voltam sozinhos.");
    expect(pendingRequestCopy("hoje às 20:10", 1)).toBe("Recebemos seu pedido hoje às 20:10. Ativamos em até 1 hora, e seus agendamentos online voltam sozinhos.");
    expect(pendingRequestCopy("hoje às 20:10", null)).toBe("Recebemos seu pedido hoje às 20:10. Seus agendamentos online voltam assim que a assinatura for ativada.");
    expect(pendingRequestCopy("hoje às 20:10", 2)).not.toBe("Recebemos seu pedido. Ativamos em até 2 h.");
  });

  it("escreve a ajuda de assinar, o vencimento e o preço a partir do plano", () => {
    expect(subscribeHelpCopy(6)).toBe("Abre o WhatsApp com o pedido pronto. Ativamos em até 6 horas.");
    expect(subscribeHelpCopy(1)).toBe("Abre o WhatsApp com o pedido pronto. Ativamos em até 1 hora.");
    expect(subscribeHelpCopy(null)).toBe("Abre o WhatsApp com o pedido pronto.");
    expect(renewalDueCopy("2026-10-16T02:59:59.000Z", zone)).toBe("Sua assinatura vence em quinta, 15 de outubro.");
    expect(SUBSCRIPTION_MANUAL_ACTIVATION_HOURS).toBe(1);
    expect(subscribeCtaLabel(planPriceCents)).toBe("Assinar por R$ 49/mês");
    expect(renewCtaLabel(planPriceCents)).toBe("Renovar por R$ 49/mês");
    expect(SUBSCRIPTION_UNAVAILABLE_COPY).toBe("A assinatura está indisponível no momento. Tente de novo mais tarde.");
    const id = "4eeb8372-55cd-4d11-910e-62d4e4374011";
    expect(subscriptionCheckoutAction(id)).toBe(`/api/businesses/${id}/subscription/checkout`);
    expect(JSON.stringify(pendingRequestCopy("hoje às 20:10", 6))).not.toMatch(/wa\.me|5514997504655/);
  });

  it("decide o POST pelo code e não devolve a message", () => {
    const leaked = "Este negócio não está disponível para sua conta.";
    expect(subscriptionPostEffect(errorBody("unauthorized", "Entre na sua conta para continuar."))).toEqual({ kind: "login" });
    expect(subscriptionPostEffect(errorBody("origin_not_allowed", "Origem da solicitação não permitida."))).toEqual({ kind: "notice", text: SUBSCRIPTION_OPEN_FAILED_COPY });
    expect(subscriptionPostEffect(errorBody("business_unavailable", leaked))).toEqual({ kind: "notice", text: SUBSCRIPTION_OPEN_FAILED_COPY });
    expect(subscriptionPostEffect(errorBody("subscription_already_active", "Sua assinatura já está ativa."))).toEqual({ kind: "notice", text: SUBSCRIPTION_ALREADY_ACTIVE_COPY });
    expect(subscriptionPostEffect(errorBody("checkout_unavailable", "A assinatura por aqui está indisponível no momento."))).toEqual({ kind: "unavailable" });
    expect(subscriptionPostEffect("ok")).toBeNull();
    expect(subscriptionPostEffect(JSON.stringify({ error: { message: leaked } }))).toBeNull();
    expect(JSON.stringify(subscriptionPostEffect(errorBody("business_unavailable", leaked)))).not.toContain(leaked);
    expect(JSON.stringify(subscriptionPostEffect(errorBody("checkout_unavailable", "A assinatura por aqui está indisponível no momento.")))).not.toContain("por aqui");
  });

  it("avisa a assinatura ativa uma vez, só depois do pedido", () => {
    expect(subscriptionActivatedToast(true, false, true)).toBe(SUBSCRIPTION_ACTIVE_TOAST);
    expect(subscriptionActivatedToast(true, true, true)).toBeNull();
    expect(subscriptionActivatedToast(false, false, true)).toBeNull();
  });
});
