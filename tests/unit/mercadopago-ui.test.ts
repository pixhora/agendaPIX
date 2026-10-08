import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MpConnectForm } from "../../components/payments/mp-connect-form";
import { isAutoRefundAck, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
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
    expect(html).toContain("Entendi e autorizo:");
    expect(html).toContain("7 dias corridos");
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

  it("accepts the checkbox value on and the current consent mocks", () => {
    expect(isAutoRefundAck("on")).toBe(true);
    expect(isAutoRefundAck(undefined)).toBe(false);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.needs_reconnect.consentVersion)).toBe(false);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.stale_consent.consentVersion)).toBe(true);
    expect(reconnectRequiresAck(MP_STATUS_FIXTURES.needs_reconnect_stale.consentVersion)).toBe(true);
    expect(MP_STATUS_FIXTURES.legacy.hadLegacyPixKey).toBe(true);
    expect(MP_STATUS_FIXTURES.connected.hadLegacyPixKey).toBe(false);
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
    expect(parsed).toMatchObject({ hadLegacyPixKey: false, consentVersion: null, liveMode: null });
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

  it("formats the connection date in São Paulo", () => {
    expect(formatConnectedSince("2026-10-08T20:02:00.000Z")).toBe("8 out 2026");
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
