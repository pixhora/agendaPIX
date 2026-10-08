import { describe, expect, it } from "vitest";
import { absentCheckout } from "../../lib/billing/checkout";
import { BASE_PLAN } from "../../lib/billing/status";
import { serviceBlockCopy } from "../../lib/dashboard/service-block";
import {
  COMPLETE_PLAN,
  LAST_DAYS_THRESHOLD,
  formatPlanReais,
  formatTrialEnd,
  formatTrialEndLong,
  subscribeCtaLabel,
  trialCopy,
  trialTone,
  toBillingView,
  type BillingView,
} from "../../lib/dashboard/trial-notice";

function billing(patch: Partial<BillingView>): BillingView {
  return {
    state: "trial",
    trialEndsAt: "2026-10-20T02:59:59.000Z",
    daysLeft: 6,
    bookingsPaused: false,
    plan: { name: "AgendaPix", priceCents: 4900 },
    subscription: null,
    checkout: absentCheckout(),
    ...patch,
  };
}

describe("aviso de teste no painel", () => {
  it("discreto enquanto faltam mais de 2 dias", () => {
    expect(LAST_DAYS_THRESHOLD).toBe(2);
    expect(trialTone(billing({ state: "trial", daysLeft: 6 }))).toBe("discreet");
    expect(trialTone(billing({ state: "trial_ending", daysLeft: 3 }))).toBe("discreet");
    const copy = trialCopy(billing({ daysLeft: 4 }), "sex, 16 out");
    expect(copy?.title).toBe("Teste grátis");
    expect(copy?.body).toBe("Restam 4 dias. Termina sex, 16 out.");
  });

  it("reforça nos últimos 2 dias, inclusive o último", () => {
    expect(trialTone(billing({ state: "trial_ending", daysLeft: 2 }))).toBe("strong");
    expect(trialCopy(billing({ daysLeft: 2 }), "sex, 16 out")?.title).toBe("Seu teste grátis termina em 2 dias");
    expect(trialCopy(billing({ daysLeft: 2 }), "sex, 16 out")?.body).toBe("Em sex, 16 out, novos agendamentos pausam. A página pública passa a avisar os clientes.");
    expect(trialTone(billing({ state: "trial_ending", daysLeft: 1 }))).toBe("strong");
    expect(trialCopy(billing({ daysLeft: 1 }), "seg, 19 out")?.title).toBe("Seu teste grátis termina amanhã");
    expect(trialTone(billing({ state: "trial_last_day", daysLeft: 0 }))).toBe("strong");
    expect(trialCopy(billing({ state: "trial_last_day", daysLeft: 0 }), "sex, 23 out")?.title).toBe("Seu teste grátis termina hoje, às 23:59");
  });

  it("pausa quando o teste acabou e some com assinatura ativa", () => {
    const paused = billing({ state: "paused", daysLeft: -1, bookingsPaused: true, trialEndsAt: "2026-10-03T02:59:59.000Z" });
    const when = formatTrialEndLong(paused.trialEndsAt, "America/Sao_Paulo");
    expect(trialTone(paused)).toBe("paused");
    expect(when).toBe("na sexta, 2 de outubro");
    expect(trialCopy(paused, when)?.body).toBe("O teste grátis acabou na sexta, 2 de outubro, e não há assinatura ativa.");
    expect(trialTone(billing({ state: "active", daysLeft: -3, bookingsPaused: false }))).toBe("none");
    expect(trialCopy(billing({ state: "active" }), "")).toBeNull();
    expect(trialTone(billing({ state: "trial", daysLeft: 5, bookingsPaused: true }))).toBe("paused");
  });

  it("escreve o fim do teste por extenso em pt-BR, sem zero à esquerda", () => {
    expect(formatTrialEndLong("2026-10-03T02:59:59.000Z", "America/Sao_Paulo")).toBe("na sexta, 2 de outubro");
    expect(formatTrialEndLong("2026-10-06T02:59:59.000Z", "America/Sao_Paulo")).toBe("na segunda, 5 de outubro");
    expect(formatTrialEndLong("2026-10-04T02:59:59.000Z", "America/Sao_Paulo")).toBe("no sábado, 3 de outubro");
    expect(formatTrialEndLong("2026-10-05T02:59:59.000Z", "America/Sao_Paulo")).toBe("no domingo, 4 de outubro");
    expect(formatTrialEndLong("2026-10-11T02:59:59.000Z", "America/Sao_Paulo")).toBe("no sábado, 10 de outubro");
    expect(formatTrialEndLong("invalid", "America/Sao_Paulo")).toBe("");
  });

  it("mostra só o plano de R$ 49 e deixa Completo fora de venda", () => {
    expect(formatPlanReais(4900)).toBe("R$ 49");
    expect(formatPlanReais(4950)).toBe("R$ 49,50");
    expect(subscribeCtaLabel(BASE_PLAN.priceCents)).toBe("Assinar por R$ 49/mês");
    expect(COMPLETE_PLAN).toEqual({ name: "Completo", available: false, label: "Em breve" });
    expect(formatTrialEnd("2026-10-16T15:00:00.000Z", "America/Sao_Paulo")).toBe("sex, 16 out");
    expect(formatTrialEnd("2026-10-20T02:59:59.000Z", "America/Sao_Paulo")).toBe("seg, 19 out");
    expect(formatTrialEnd("2026-10-23T15:00:00.000Z", "America/Sao_Paulo")).toBe("sex, 23 out");
    expect(formatTrialEnd("2026-10-03T02:59:59.000Z", "America/Sao_Paulo")).toBe("sex, 2 out");
    expect(formatTrialEnd("invalid", "America/Sao_Paulo")).toBe("");
    expect(trialCopy(billing({ daysLeft: 5 }), formatTrialEnd("2026-10-20T02:59:59.000Z", "America/Sao_Paulo"))?.body).toBe("Restam 5 dias. Termina seg, 19 out.");
  });

  it("serializa a resposta de cobrança sem perder o fim do teste", () => {
    const view = toBillingView({
      state: "trial_ending",
      trialEndsAt: new Date("2026-10-20T02:59:59.000Z"),
      daysLeft: 2,
      bookingsPaused: false,
      plan: { name: "AgendaPix", priceCents: 4900 },
      subscription: { status: "canceled", currentPeriodEnd: null, provider: null },
    });
    expect(view.trialEndsAt).toBe("2026-10-20T02:59:59.000Z");
    expect(view.subscription).toEqual({ status: "canceled", currentPeriodEnd: null, provider: null });
    expect(view.checkout).toEqual(absentCheckout());
    expect(trialTone(view)).toBe("strong");
  });

  it("não promete devolução automática nem trata a marca no feminino", () => {
    const texts = [
      trialCopy(billing({ daysLeft: 1 }), "amanhã")?.body,
      trialCopy(billing({ state: "paused", bookingsPaused: true, daysLeft: -1 }), "na sexta, 2 de outubro")?.body,
    ].join(" ");
    expect(texts).not.toMatch(/automática/i);
    expect(texts).not.toMatch(/\ba AgendaPix\b/);
  });
});

describe("motivo de bloqueio na lista de serviços", () => {
  it("null não gera aviso", () => {
    expect(serviceBlockCopy(null)).toBeNull();
  });

  it("explica a pausa do teste e a conta Mercado Pago sem botão de conexão", () => {
    expect(serviceBlockCopy("bookings_paused")?.body).toMatch(/teste grátis/);
    expect(serviceBlockCopy("bookings_paused")?.body).toMatch(/página pública/);
    const mp = serviceBlockCopy("mp_account_not_connected");
    expect(mp?.body).toMatch(/Mercado Pago/);
    expect(mp?.body).not.toMatch(/conectar agora/i);
    expect(JSON.stringify(mp)).not.toMatch(/chave Pix/i);
  });
});
