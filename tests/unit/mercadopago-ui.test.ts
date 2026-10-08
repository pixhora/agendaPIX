import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AutoRefundAck, MpConnectForm } from "../../components/payments/mp-connect-form";
import { MpDisconnectDialog } from "../../components/payments/mp-disconnect-dialog";
import { MpOnboardingStep } from "../../components/payments/mp-onboarding-step";
import { MpSettingsCard } from "../../components/payments/mp-settings-card";
import { isAutoRefundAck, MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import {
  MP_AUTO_REFUND_ACK_ERROR,
  MP_AUTO_REFUND_ACK_HINT,
  MP_GOOD_TO_KNOW,
  MP_MOCK_FRIDAY_16,
  MP_MOCK_FRIDAY_23,
} from "../../lib/mercadopago/connect-copy";
import { MP_STATUS_FIXTURES } from "../../lib/mercadopago/dev-fixtures";
import {
  AUTO_REFUND_ACK_ERROR,
  bannerDismissUntil,
  bannerHiddenUntil,
  callbackFocusesAck,
  formatConnectedSince,
  gateConnectSubmit,
  legacyNoticeAfterDismiss,
  legacyNoticeVisible,
  legacyPixDismissUrl,
  mpAccountLines,
  parseMpOwnerStatus,
  presentMpCallback,
  reconnectRequiresAck,
  selectMpBanners,
  showsTestMode,
  statusBadge,
} from "../../lib/mercadopago/contract";

describe("Mercado Pago connect consent", () => {
  it("blocks continue until the owner checks the automatic refund", () => {
    expect(gateConnectSubmit(false)).toEqual({ ok: false, message: AUTO_REFUND_ACK_ERROR });
    expect(gateConnectSubmit(true)).toEqual({ ok: true });
  });

  it("asks for the checkbox again only when the accepted version differs", () => {
    expect(reconnectRequiresAck(null)).toBe(true);
    expect(reconnectRequiresAck(undefined)).toBe(true);
    expect(reconnectRequiresAck("2026-09-01.v1")).toBe(true);
    expect(reconnectRequiresAck(MP_CONNECT_CONSENT_VERSION)).toBe(false);
  });

  it("posts a native form with the consent version and keeps the checkbox unchecked", () => {
    const html = renderToStaticMarkup(createElement(MpConnectForm, {
      businessId: "biz 1",
      returnTo: "/onboarding",
      requireAck: true,
      acknowledged: false,
      onAcknowledgedChange: () => undefined,
      ackInvalid: false,
      submitLabel: "Continuar para o Mercado Pago",
      onBlocked: () => undefined,
    }));
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/businesses/biz%201/mercadopago/connect"');
    expect(html).toContain('name="returnTo" value="/onboarding"');
    expect(html).toContain(`name="consentVersion" value="${MP_CONNECT_CONSENT_VERSION}"`);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="autoRefundAck" value="on"');
    expect(html).toContain("required");
    expect(html).toContain(MP_AUTO_REFUND_ACK_HINT);
    const label = html.slice(html.indexOf("<label"), html.indexOf("</label>") + "</label>".length);
    expect(label.replace(/<[^>]*>/g, "")).toBe(MP_CONNECT_CONSENT_TEXT);
    expect(html).not.toMatch(/checked=/);
    expect(html).not.toMatch(/<button\b[^>]*\sdisabled[\s=>]/);
    expect(html).not.toContain('href="/api/');
    expect(html).not.toContain("noreferrer");
    expect(html).not.toContain("referrerpolicy");
  });

  it("omits the checkbox when the current consent is already accepted", () => {
    const html = renderToStaticMarkup(createElement(MpConnectForm, {
      businessId: "biz",
      returnTo: "/dashboard",
      requireAck: false,
      acknowledged: true,
      onAcknowledgedChange: () => undefined,
      ackInvalid: false,
      submitLabel: "Reconectar",
      onBlocked: () => undefined,
    }));
    expect(html).toContain('type="hidden" name="autoRefundAck" value="on"');
    expect(html).toContain('name="returnTo" value="/dashboard"');
    expect(html).not.toContain("Entendi e autorizo");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("noreferrer");
    expect(html).not.toContain("referrerpolicy");
  });

  it("renders the checkbox label from the hashed consent text", () => {
    const html = renderToStaticMarkup(createElement(AutoRefundAck, {
      checked: false,
      onChange: () => undefined,
      invalid: false,
    }));
    const label = html.slice(html.indexOf("<label"), html.indexOf("</label>") + "</label>".length);
    expect(label.replace(/<[^>]*>/g, "")).toBe(MP_CONNECT_CONSENT_TEXT);
    const colon = MP_CONNECT_CONSENT_TEXT.indexOf(":");
    expect(html).toContain(`<strong class="font-semibold">${MP_CONNECT_CONSENT_TEXT.slice(0, colon + 1)}</strong>`);
  });

  it("keeps the published consent version and the other screen strings", () => {
    expect(MP_CONNECT_CONSENT_VERSION).toBe("2026-10-08.v3.2");
    expect(MP_AUTO_REFUND_ACK_ERROR).toBe("Marque a autorização da devolução automática para continuar.");
    expect(MP_GOOD_TO_KNOW).toHaveLength(5);
    expect(MP_GOOD_TO_KNOW[1]).toContain("em até 7 dias corridos, contados do aviso.");
    expect(MP_GOOD_TO_KNOW[3]).toContain("conta sua");
  });

  it("leaves continue focusable and lets skip ignore the checkbox", () => {
    const html = renderToStaticMarkup(createElement(MpOnboardingStep, { businessId: "biz" }));
    expect(html).not.toMatch(/<button\b[^>]*\sdisabled[\s=>]/);
    expect(html).toContain("Continuar para o Mercado Pago");
    expect(html).toContain('href="/onboarding/concluir"');
    expect(html).toContain("Agora não");
    expect(html).toContain("data-mp-sticky");
    const skipAt = html.indexOf("Se pular agora");
    const consentAt = html.indexOf("Entendi e autorizo");
    const stickyAt = html.indexOf("data-mp-sticky");
    const ctaAt = html.indexOf("Continuar para o Mercado Pago");
    expect(skipAt).toBeGreaterThan(-1);
    expect(skipAt).toBeLessThan(consentAt);
    expect(consentAt).toBeLessThan(stickyAt);
    expect(stickyAt).toBeLessThan(ctaAt);
    const sticky = html.slice(stickyAt);
    expect(sticky).not.toContain("Entendi e autorizo");
    for (const line of MP_GOOD_TO_KNOW) {
      if (line.startsWith("Conecte uma conta sua")) {
        expect(html).toContain("Conecte uma conta");
        expect(html).toContain("(ou do seu negócio), com uma chave Pix cadastrada. É nela que os clientes vão pagar.");
      } else {
        expect(html).toContain(line);
      }
    }
  });

  it("accepts the checkbox value on and the current consent mocks", () => {
    expect(isAutoRefundAck("on")).toBe(true);
    expect(isAutoRefundAck(undefined)).toBe(false);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.needs_reconnect.consentVersion)).toBe(false);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.stale_consent.consentVersion)).toBe(true);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.needs_reconnect_stale.consentVersion)).toBe(true);
    expect(MP_STATUS_FIXTURES.legacy.hadLegacyPixKey).toBe(true);
    expect(MP_STATUS_FIXTURES.connected.hadLegacyPixKey).toBe(false);
    expect(MP_STATUS_FIXTURES.connected.accountName).toBe("Ana S.");
    expect(MP_STATUS_FIXTURES.connected.accountEmailMasked).toBe("an••@gmail.com");
    expect(MP_STATUS_FIXTURES.not_connected.accountName).toBeNull();
    expect(MP_STATUS_FIXTURES.not_connected.accountEmailMasked).toBeNull();
    expect(MP_STATUS_FIXTURES.not_connected.accountIdLast4).toBeNull();
    expect(MP_STATUS_FIXTURES.account_fallback.accountName).toBeNull();
    expect(MP_STATUS_FIXTURES.account_fallback.accountIdLast4).toBe("3636");
  });

  it("shows the account name and masked email, or the last four digits", () => {
    expect(mpAccountLines({
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "3636",
    })).toEqual({ title: "Ana S.", detail: "an••@gmail.com" });
    expect(mpAccountLines({
      accountName: null,
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "3636",
    })).toEqual({ title: "an••@gmail.com", detail: null });
    expect(mpAccountLines({
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: "3636",
    })).toEqual({ title: "Conta Mercado Pago nº ••••3636", detail: null });
    expect(mpAccountLines({
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    })).toEqual({ title: "Conta Mercado Pago", detail: null });

    const named = renderToStaticMarkup(createElement(MpOnboardingStep, {
      businessId: "biz",
      callback: presentMpCallback("connected", null),
      connectedAt: MP_MOCK_FRIDAY_16,
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "3636",
      onDismissAccount: () => undefined,
    }));
    const nameAt = named.indexOf("Ana S.");
    const emailAt = named.indexOf("an••@gmail.com");
    const switchAt = named.indexOf("Não é essa conta?");
    expect(nameAt).toBeGreaterThan(-1);
    expect(nameAt).toBeLessThan(emailAt);
    expect(switchAt).toBeGreaterThan(nameAt);

    const fallback = renderToStaticMarkup(createElement(MpOnboardingStep, {
      businessId: "biz",
      callback: presentMpCallback("connected", null),
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: "3636",
      onDismissAccount: () => undefined,
    }));
    expect(fallback).toContain("Conta Mercado Pago nº ••••3636");
    expect(fallback).toContain("Não é essa conta?");

    const settings = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.connected,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(settings).toContain("Ana S.");
    expect(settings).toContain("an••@gmail.com");
  });

  it("centers the disconnect dialog and links the Mercado Pago apps help", () => {
    const html = renderToStaticMarkup(createElement(MpDisconnectDialog, {
      open: true,
      pending: false,
      pendingPixCount: 2,
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }));
    expect(html).toContain("-translate-x-1/2");
    expect(html).toContain("-translate-y-1/2");
    expect(html).toContain("rounded-t-frame");
    expect(html).toContain('href="https://www.mercadopago.com.br/ajuda/26873"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).not.toContain("noreferrer");
    expect(html).toContain("Segurança › Aplicativos conectados");
    expect(html).toContain("você também pode remover a permissão do AgendaPix.");
    expect(html).toContain("(abre em nova aba)");
    expect(html).not.toContain("desvincule o AgendaPix");
    expect(html).toContain("2 clientes estão com Pix em aberto.");
    expect(html).toContain(">Cancelar<");
  });
});

describe("legacy Pix notice", () => {
  it("shows the notice only when the flag is strictly true and hides it after 204", () => {
    expect(legacyNoticeVisible(undefined, false)).toBe(false);
    expect(legacyNoticeVisible(false, false)).toBe(false);
    expect(legacyNoticeVisible(true, false)).toBe(true);
    expect(legacyNoticeVisible(true, true)).toBe(false);
    expect(legacyNoticeAfterDismiss(204)).toBe("hidden");
    expect(legacyNoticeAfterDismiss(200)).toBe("visible");
    expect(legacyNoticeAfterDismiss(500)).toBe("visible");
    expect(legacyPixDismissUrl("biz/1")).toBe("/api/businesses/biz%2F1/notices/pix_key_retired/dismiss");
  });

  it("treats a missing legacy flag as false", () => {
    const parsed = parseMpOwnerStatus({ status: "connected", canReceiveDeposits: true });
    expect(parsed).toMatchObject({
      hadLegacyPixKey: false,
      consentVersion: null,
      liveMode: null,
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    });
    expect(parseMpOwnerStatus({
      status: "connected",
      accountName: "  ",
      accountEmailMasked: "",
      accountIdLast4: "3636",
    })).toMatchObject({ accountName: null, accountEmailMasked: null, accountIdLast4: "3636" });
  });
});

describe("Mercado Pago status mapping", () => {
  it("maps the three owner statuses and the test-mode flag", () => {
    expect(statusBadge("connected").label).toBe("Conectado");
    expect(statusBadge("not_connected").label).toBe("Não conectado");
    expect(statusBadge("needs_reconnect")).toEqual({ tone: "needs_reconnect", label: "Desconectado" });
    expect(showsTestMode(false)).toBe(true);
    expect(showsTestMode(true)).toBe(false);
    expect(showsTestMode(null)).toBe(false);
    expect(parseMpOwnerStatus({ status: "paused" })).toBeNull();
    expect(parseMpOwnerStatus({
      status: "needs_reconnect",
      connectedAt: "2026-10-08T20:02:00.000Z",
      liveMode: false,
      canReceiveDeposits: false,
      hadLegacyPixKey: true,
      consentVersion: MP_CONNECT_CONSENT_VERSION,
    })).toMatchObject({
      status: "needs_reconnect",
      liveMode: false,
      hadLegacyPixKey: true,
      consentVersion: MP_CONNECT_CONSENT_VERSION,
    });
  });

  it("formats the 2026 mock Fridays in São Paulo", () => {
    const weekday = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
    expect(formatConnectedSince(MP_MOCK_FRIDAY_16)).toBe("16 out 2026");
    expect(weekday(MP_MOCK_FRIDAY_16)).toBe("sexta-feira");
    expect(formatConnectedSince(MP_MOCK_FRIDAY_23)).toBe("23 out 2026");
    expect(weekday(MP_MOCK_FRIDAY_23)).toBe("sexta-feira");
    expect(MP_STATUS_FIXTURES.connected.connectedAt).toBe(MP_MOCK_FRIDAY_16);
  });

  it("picks banners from connection status only", () => {
    expect(selectMpBanners({ status: "needs_reconnect", hasDepositService: false })).toEqual(["mp-reauth"]);
    expect(selectMpBanners({ status: "connected", hasDepositService: true })).toEqual([]);
    expect(selectMpBanners({ status: "not_connected", hasDepositService: true })).toEqual(["mp-not-connected"]);
    expect(selectMpBanners({ status: "not_connected", hasDepositService: false, blockedReasons: ["mp_account_not_connected"] })).toEqual(["mp-not-connected"]);
    expect(selectMpBanners({ status: "not_connected", hasDepositService: false })).toEqual([]);
  });

  it("maps callback reasons and focuses the checkbox for a missing ack", () => {
    const error = (reason: string) => {
      const view = presentMpCallback("error", reason);
      if (!view || view.mp !== "error") throw new Error("expected error callback");
      return view;
    };
    expect(presentMpCallback("connected", null)?.toast).toBe("Conta Mercado Pago conectada.");
    expect(error("access_denied").tone).toBe("warning");
    expect(error("state_mismatch").message).toMatch(/tempo/);
    expect(error("expired_code").message).toMatch(/tempo/);
    expect(error("exchange_failed").tone).toBe("danger");
    expect(error("already_linked_elsewhere").message).toMatch(/outro negócio/);
    const ack = error("auto_refund_ack_required");
    expect(ack.message).toBe(AUTO_REFUND_ACK_ERROR);
    expect(callbackFocusesAck(ack)).toBe(true);
    expect(callbackFocusesAck(error("access_denied"))).toBe(false);
    expect(error("nope").reason).toBe("unknown");
    expect(presentMpCallback(null, null)).toBeNull();
  });

  it("hides a dismissed banner for one day", () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    const until = bannerDismissUntil(now);
    expect(until - now).toBe(24 * 60 * 60 * 1000);
    expect(bannerHiddenUntil(String(until), now)).toBe(true);
    expect(bannerHiddenUntil(String(now), now)).toBe(false);
    expect(bannerHiddenUntil(null, now)).toBe(false);
  });
});
