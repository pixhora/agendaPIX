import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BookingFlow } from "../../components/booking/BookingFlow";
import { AutoRefundAck, MpConnectForm } from "../../components/payments/mp-connect-form";
import { MpDisconnectDialog } from "../../components/payments/mp-disconnect-dialog";
import { MpOnboardingStep } from "../../components/payments/mp-onboarding-step";
import { MpSettingsCard } from "../../components/payments/mp-settings-card";
import { isAutoRefundAck, MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import {
  MP_AUTO_REFUND_ACK_ERROR,
  MP_AUTO_REFUND_ACK_HINT,
  MP_GOOD_TO_KNOW,
  MP_MOCK_FRIDAY_2,
  MP_MOCK_FRIDAY_25,
} from "../../lib/mercadopago/connect-copy";
import { MP_STATUS_FIXTURES } from "../../lib/mercadopago/dev-fixtures";
import {
  AUTO_REFUND_ACK_ERROR,
  LEGACY_PIX_NOTICE,
  MP_ACCOUNT_NOT_CONNECTED,
  bannerDismissUntil,
  bannerHiddenUntil,
  callbackFocusesAck,
  formatConnectedSince,
  gateConnectSubmit,
  legacyNoticeAfterDismiss,
  legacyNoticeVisible,
  legacyPixDismissUrl,
  mpAccountIdentity,
  depositUnavailable,
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
    expect(MP_CONNECT_CONSENT_VERSION).toBe("2026-10-09.v4");
    expect(MP_CONNECT_CONSENT_TEXT).toContain("depois do prazo para reservar o horário");
    expect(MP_CONNECT_CONSENT_TEXT).not.toContain("horário já estiver ocupado");
    expect(MP_AUTO_REFUND_ACK_ERROR).toBe("Marque a autorização da devolução automática para continuar.");
    expect(MP_GOOD_TO_KNOW).toHaveLength(5);
    expect(MP_GOOD_TO_KNOW[1]).toContain("em até 7 dias corridos, contados do aviso.");
    expect(MP_GOOD_TO_KNOW[3]).toContain("conta sua");
  });

  it("leaves continue focusable and lets skip ignore the checkbox", () => {
    const html = renderToStaticMarkup(createElement(MpOnboardingStep, { businessId: "biz" }));
    expect(html).not.toMatch(/<button\b[^>]*\sdisabled[\s=>]/);
    expect(html).toContain("o AgendaPix pede a devolução do valor ao Mercado Pago");
    expect(html).toContain("Na política padrão, todo Pix atrasado é devolvido.");
    expect(html).not.toContain("Se você escolher remarcar");
    expect(html).not.toContain("único caso");
    expect(html).not.toContain("horário já está ocupado");
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
    expect(MP_STATUS_FIXTURES.not_connected).toMatchObject({
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    });
  });

  it("shows name and email, email alone, or the last-4 fallback", () => {
    const named = renderToStaticMarkup(createElement(MpOnboardingStep, {
      businessId: "biz",
      callback: presentMpCallback("connected", null),
      connectedAt: MP_MOCK_FRIDAY_2,
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "7766",
    }));
    const nameAt = named.indexOf("Ana S.");
    const emailAt = named.indexOf("an••@gmail.com");
    const sinceAt = named.indexOf("Conectado desde 2 de outubro de 2026");
    const depositAt = named.indexOf("O sinal dos clientes cai direto nesta conta.");
    const feesAt = named.indexOf("Ver tarifas no Mercado Pago");
    const refundsAt = named.indexOf("Devoluções:");
    const reconnectAt = named.indexOf("Reconectar");
    const disconnectAt = named.indexOf(">Desconectar<");
    expect(nameAt).toBeGreaterThan(-1);
    expect(emailAt).toBeGreaterThan(nameAt);
    expect(sinceAt).toBeGreaterThan(emailAt);
    expect(depositAt).toBeGreaterThan(sinceAt);
    expect(feesAt).toBeGreaterThan(depositAt);
    expect(refundsAt).toBeGreaterThan(feesAt);
    expect(reconnectAt).toBeGreaterThan(refundsAt);
    expect(disconnectAt).toBeGreaterThan(reconnectAt);
    expect(named).toContain("Continuar");
    expect(named).not.toContain("Não é essa conta?");
    expect(named).not.toContain("••••7766");
    const reconnectButton = named.slice(named.lastIndexOf("<button", reconnectAt), reconnectAt);
    expect(reconnectButton).toContain("border");
    expect(reconnectButton).not.toContain("bg-pix ");
    const disconnectLink = named.slice(disconnectAt - 400, disconnectAt);
    expect(disconnectLink).toContain("text-base");
    expect(disconnectLink).toContain("text-danger");
    expect(disconnectLink).toContain("self-start");
    expect(disconnectLink).not.toContain("bg-danger");

    const emailOnly = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.email_only,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(emailOnly).toContain("an••@gmail.com");
    expect(emailOnly).not.toContain("Ana S.");
    expect(emailOnly).not.toContain("••••7766");

    const fallback = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.account_fallback,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(fallback).toContain("Conta Mercado Pago nº ••••7766");
    expect(fallback).not.toContain("an••@gmail.com");
    expect(mpAccountIdentity({ accountName: "Ana", accountEmailMasked: null, accountIdLast4: "7766" })?.title).toBe("Conta Mercado Pago nº ••••7766");

    const settings = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.connected,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(settings).toContain("Ana S.");
    expect(settings).toContain("an••@gmail.com");
    expect(settings).toContain("Conectado desde 2 de outubro de 2026");
    expect(settings).toContain('rel="noopener"');
    expect(settings).toContain("Ver tarifas no Mercado Pago");
    expect(settings).toContain("(abre em nova aba)");
    expect(settings).not.toContain("noreferrer");
    expect(settings).toContain("Reconectar");
    expect(settings).not.toContain(LEGACY_PIX_NOTICE);
    expect(settings).not.toContain("hover:bg-danger-soft");
    const settingsReconnect = settings.indexOf("Reconectar");
    const settingsDisconnect = settings.indexOf(">Desconectar<");
    const settingsRefunds = settings.indexOf("Devoluções:");
    expect(settingsRefunds).toBeLessThan(settingsReconnect);
    expect(settingsReconnect).toBeLessThan(settingsDisconnect);
    const settingsButton = settings.slice(settings.lastIndexOf("<button", settingsReconnect), settingsReconnect);
    expect(settingsButton).toContain("border");
    expect(settingsButton).not.toContain("bg-pix ");

    const stale = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.stale_consent,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(stale).toContain("Aceite o texto novo para voltar a receber sinal");
    expect(stale).toContain("Não precisa entrar de novo no Mercado Pago.");
    expect(stale).toContain("Aceitar e voltar a receber sinal");
    expect(stale).toContain("Entendi e autorizo:");
    expect(stale).not.toContain(">Reconectar<");

    const staleReconnect = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.needs_reconnect_stale,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(staleReconnect).toContain("Para aceitar o texto novo, entre de novo no Mercado Pago.");
    expect(staleReconnect).toContain("Sem reconectar, o aceite não vale.");

    const paused = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.needs_reconnect,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    const pausedReconnect = paused.indexOf("Reconectar");
    expect(paused.slice(paused.lastIndexOf("<button", pausedReconnect), pausedReconnect)).toContain("bg-pix ");
    expect(paused).toContain("O Mercado Pago encerrou a conexão.");
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
    expect(html).toContain("em até 24 horas depois que eles forem pagos, vencerem ou forem cancelados");
    expect(html).toContain("Enquanto houver Pix em aberto, o AgendaPix guarda o acesso");
    expect(html).not.toContain("45 minutos");
    expect(html).not.toContain("apaga agora");
    expect(html).not.toContain("por mais 24 horas");
    expect(html).not.toContain("Devolver pelo AgendaPix");
    expect(html).toContain(">Cancelar<");
    const now = renderToStaticMarkup(createElement(MpDisconnectDialog, {
      open: true,
      pending: false,
      pendingPixCount: 0,
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }));
    expect(now).toContain("O AgendaPix apaga agora o acesso à sua conta.");
    expect(now).toContain("Devoluções, a partir de agora, inclusive as de Pix pago fora do prazo, você faz direto no Mercado Pago.");
    expect(now).not.toContain("45 minutos");
    expect(now).not.toContain("com Pix em aberto");
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

  it("treats a missing legacy flag as false and hides the notice", () => {
    const parsed = parseMpOwnerStatus({ status: "connected", canReceiveDeposits: true });
    expect(parsed).toMatchObject({
      hadLegacyPixKey: false,
      consentVersion: null,
      liveMode: null,
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    });
    const quiet = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: { ...MP_STATUS_FIXTURES.connected, hadLegacyPixKey: false },
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(quiet).not.toContain(LEGACY_PIX_NOTICE);
    const notice = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.legacy,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    const legacyAt = notice.indexOf(LEGACY_PIX_NOTICE);
    const sinceAt = notice.indexOf("Conectado desde");
    const depositAt = notice.indexOf("O sinal dos clientes cai direto nesta conta.");
    expect(sinceAt).toBeGreaterThan(-1);
    expect(legacyAt).toBeGreaterThan(sinceAt);
    expect(depositAt).toBeGreaterThan(legacyAt);
    expect(notice).toContain(LEGACY_PIX_NOTICE);
    expect(notice).toContain(">Entendi<");
    expect(notice).toContain("não é mais usada");
    expect(notice).not.toContain("chave ativa");
    expect(notice).not.toContain("localStorage");
    expect(quiet).not.toContain(">Entendi<");
  });

  it("keeps the retired Pix notice in the first HTML only when the GET flag is true", () => {
    const source = readFileSync(resolve(process.cwd(), "components/payments/mp-settings-card.tsx"), "utf8");
    expect(source).not.toContain("localStorage");
    expect(source).toContain("legacyPixDismissUrl");
    const shown = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: MP_STATUS_FIXTURES.legacy,
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    const hidden = renderToStaticMarkup(createElement(MpSettingsCard, {
      businessId: "biz",
      status: { ...MP_STATUS_FIXTURES.legacy, hadLegacyPixKey: false },
      timezone: "America/Sao_Paulo",
      onStatus: () => undefined,
    }));
    expect(shown).toContain(LEGACY_PIX_NOTICE);
    expect(hidden).not.toContain(LEGACY_PIX_NOTICE);
    expect(legacyPixDismissUrl("biz")).toBe("/api/businesses/biz/notices/pix_key_retired/dismiss");
  });

  it("reads the connected account fields and clears them when not connected", () => {
    expect(parseMpOwnerStatus({
      status: "connected",
      connectedAt: MP_MOCK_FRIDAY_2,
      expiresAt: "2027-04-06T20:02:00.000Z",
      liveMode: false,
      canReceiveDeposits: true,
      consentVersion: "2026-10-09.v4",
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "7766",
      hadLegacyPixKey: false,
    })).toMatchObject({
      status: "connected",
      liveMode: false,
      canReceiveDeposits: true,
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "7766",
      hadLegacyPixKey: false,
    });
    expect(parseMpOwnerStatus({
      status: "not_connected",
      accountName: "Ana S.",
      accountEmailMasked: "an••@gmail.com",
      accountIdLast4: "7766",
    })).toMatchObject({
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    });
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
    expect(formatConnectedSince(MP_MOCK_FRIDAY_2)).toBe("2 de outubro de 2026");
    expect(weekday(MP_MOCK_FRIDAY_2)).toBe("sexta-feira");
    expect(formatConnectedSince(MP_MOCK_FRIDAY_25)).toBe("25 de setembro de 2026");
    expect(weekday(MP_MOCK_FRIDAY_25)).toBe("sexta-feira");
    expect(MP_STATUS_FIXTURES.connected.connectedAt).toBe(MP_MOCK_FRIDAY_2);
  });

  it("drops the booking steps when every service is unavailable", () => {
    const html = renderToStaticMarkup(createElement(BookingFlow, {
      slug: "studio-ana",
      previewBusiness: {
        name: "Studio Ana",
        timezone: "America/Sao_Paulo",
        phone: "5511999998888",
        services: [
          {
            id: "corte",
            name: "Corte",
            durationMinutes: 45,
            priceCents: 8000,
            depositCents: 2000,
            bookable: false,
            reason: MP_ACCOUNT_NOT_CONNECTED,
          },
        ],
      },
    }));
    expect(html).toContain("Agendamento online indisponível no momento");
    expect(html).toContain("Studio Ana não está recebendo agendamentos online agora. Fale direto pelo WhatsApp.");
    expect(html).not.toContain("temporariamente indisponíveis");
    expect(html).not.toContain("max-w-[34ch]");
    expect(html).not.toContain("Feito com o AgendaPix");
    expect(html).not.toContain("Feito com AgendaPix");
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("Agenda com sinal no Pix feita no AgendaPix.");
    expect(html).toContain("utm_campaign=pagina_publica");
    expect(html).not.toContain("Passo 1 de 4");
    expect(html).not.toContain("O sinal garante o horário");
    expect(html).not.toContain("Agendamento online · sinal por Pix");
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/:is\(h1, h2, h3, h4, h5, h6, p, main\)\[tabindex="-1"\]:focus\s*\{[^}]*outline:\s*none/);
  });

  it("picks banners from connection status only", () => {
    expect(selectMpBanners({ status: "needs_reconnect", hasDepositService: false })).toEqual(["mp-reauth"]);
    expect(selectMpBanners({ status: "connected", hasDepositService: true })).toEqual([]);
    expect(selectMpBanners({ status: "connected", hasDepositService: true, consentOutdated: true })).toEqual(["mp-consent"]);
    expect(depositUnavailable({ bookable: false, blockedReason: "mp_consent_outdated" })).toBe(true);
    expect(depositUnavailable({ bookable: false, blockedReason: "mp_account_not_connected" })).toBe(true);
    expect(depositUnavailable({ bookable: false, reason: "bookings_paused" })).toBe(false);
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
