import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { HttpError, json } from "../../lib/http";
import { MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import { MpConnectFailure, MpConnectFailureCode } from "../../lib/mercadopago/connect-failure";
import {
  MP_CONNECT_CONFIG_COPY,
  MP_CONNECT_FAILURE_BODY,
  MP_CONNECT_FAILURE_TITLE,
  ownerConnectConfigCopy,
  respondMercadoPagoConnect,
} from "../../lib/mercadopago/connect-navigation";

const connectRoute = resolve(process.cwd(), "app/api/businesses/[businessId]/mercadopago/connect/route.ts");
const callbackRoute = resolve(process.cwd(), "app/api/integrations/mercadopago/callback/route.ts");
const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  delete process.env.SUPPORT_WHATSAPP_NUMBER;
});

afterEach(() => {
  errorLog.mockClear();
  delete process.env.SUPPORT_WHATSAPP_NUMBER;
});

const leak = "postgres://agenda:s3cret@db.internal:5432/agendapix client_secret=mp-client-secret-do-not-leak state=oauth-state-value-xyz code=TG-authorization-code-9988 APP_USR-super-secret-token";

function formRequest(returnTo: string, accept = "text/html,application/xhtml+xml", extra?: Record<string, string>) {
  return new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
    method: "POST",
    headers: {
      accept,
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
    },
    body: new URLSearchParams({ returnTo, autoRefundAck: "on", consentVersion: MP_CONNECT_CONSENT_VERSION, ...extra }),
  });
}

function assertSafePage(html: string, code: MpConnectFailureCode) {
  expect(html).toContain(MP_CONNECT_FAILURE_TITLE);
  expect(html).toContain(MP_CONNECT_FAILURE_BODY);
  expect(html).toContain("Tentar de novo");
  expect(html).toContain("Voltar ao painel");
  expect(html).toContain(`Código: ${code}`);
  expect(html).toContain("font-size: 12px");
  expect(html).toContain("min-height: 44px");
  expect(html).toContain("prefers-color-scheme: dark");
  expect(html).toContain(":focus-visible");
  expect(html).toContain('method="post"');
  expect(html).toContain('type="submit"');
  expect(html).not.toContain("Conexão indisponível");
  expect(html).not.toContain(leak);
  expect(html).not.toContain("client_secret");
  expect(html).not.toContain("postgres://");
  expect(html).not.toContain("<script");
}

describe("página de falha do connect antes do redirect", () => {
  it("mostra MP-CONFIG sem a frase interna nem o nome da variável", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/onboarding"), async () => {
      throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off.");
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.Config);
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain('action="/api/businesses/x/mercadopago/connect"');
    expect(html).toContain('name="autoRefundAck" value="on"');
    expect(html).toContain(`name="consentVersion" value="${MP_CONNECT_CONSENT_VERSION}"`);
    expect(html).not.toContain(MP_CONNECT_CONFIG_COPY);
    expect(html).not.toContain("mp_oauth_pkce_invalid");
    expect(html).not.toContain("MP_OAUTH_PKCE");
    expect(html).not.toContain("deve ser on ou off");
    expect(ownerConnectConfigCopy("mp_oauth_pkce_invalid")).toBe(MP_CONNECT_CONFIG_COPY);
    expect(ownerConnectConfigCopy("mp_oauth_unconfigured")).toBe(MP_CONNECT_CONFIG_COPY);
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-CONFIG cause=mp_oauth_pkce_invalid");
  });

  it("trata configuração ausente como MP-CONFIG e mantém o 503", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", `${MP_CONNECT_CONFIG_COPY} ${leak}`);
    });
    expect(response.status).toBe(503);
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.Config);
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("mp_oauth_unconfigured");
    expect(html).not.toContain(MP_CONNECT_CONFIG_COPY);
  });

  it("mostra MP-ORIGIN no 403 sem a mensagem do corpo", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      return json({ error: { code: "forbidden_origin", message: leak } }, 403);
    });
    expect(response.status).toBe(403);
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.Origin);
    expect(html).not.toContain("forbidden_origin");
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-ORIGIN cause=forbidden_origin");
  });

  it("mantém o JSON de origem e o 400 de aceite", async () => {
    const forbidden = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/dashboard" }),
    });
    const forbiddenResponse = await respondMercadoPagoConnect(forbidden, async () => {
      return json({ error: { code: "forbidden_origin", message: leak } }, 403);
    });
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.headers.get("content-type")).toContain("application/json");
    await expect(forbiddenResponse.json()).resolves.toEqual({ error: { code: "forbidden_origin", message: leak } });
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-ORIGIN cause=forbidden_origin");

    errorLog.mockClear();
    const ack = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/dashboard", autoRefundAck: false }),
    });
    const ackResponse = await respondMercadoPagoConnect(ack, async () => {
      return json({ error: { code: "auto_refund_ack_required" } }, 400);
    });
    expect(ackResponse.status).toBe(400);
    await expect(ackResponse.json()).resolves.toEqual({ error: { code: "auto_refund_ack_required" } });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("mostra MP-STATE quando gravar o state falha e mantém o 500", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new MpConnectFailure(MpConnectFailureCode.State, Object.assign(new Error(leak), { code: "23505" }));
    });
    expect(response.status).toBe(500);
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.State);
    expect(html).not.toContain("23505");
    expect(html).not.toContain("oauth_state_write");
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-STATE cause=oauth_state_write sqlstate=23505");
  });

  it("mostra MP-DB num erro de banco e mantém o 500", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new MpConnectFailure(MpConnectFailureCode.Database, Object.assign(new Error(leak), { code: "57P01" }));
    });
    expect(response.status).toBe(500);
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.Database);
    expect(html).not.toContain("57P01");
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-DB cause=database sqlstate=57P01");
  });

  it("mostra MP-UNKNOWN para o resto e não ecoa a exceção", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new Error(leak);
    });
    expect(response.status).toBe(500);
    const html = await response.text();
    assertSafePage(html, MpConnectFailureCode.Unknown);
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-UNKNOWN cause=unexpected");

    const missing = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(404, "business_unavailable", `Este negócio não está disponível. ${leak}`);
    });
    expect(missing.status).toBe(404);
    const missingHtml = await missing.text();
    assertSafePage(missingHtml, MpConnectFailureCode.Unknown);
    expect(missingHtml).not.toContain("business_unavailable");
    expect(missingHtml).not.toContain("Este negócio não está disponível");
  });

  it("omite o WhatsApp sem número válido e usa SUPPORT_WHATSAPP_NUMBER quando existe", async () => {
    const absent = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", leak);
    });
    const absentHtml = await absent.text();
    expect(absentHtml).not.toContain("Suporte no WhatsApp");
    expect(absentHtml).not.toContain("wa.me");
    expect(absentHtml).not.toContain("5514997504655");

    process.env.SUPPORT_WHATSAPP_NUMBER = "5500000000000";
    const placeholder = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", leak);
    });
    expect(await placeholder.text()).not.toContain("wa.me");

    process.env.SUPPORT_WHATSAPP_NUMBER = "5511912345678";
    const present = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", leak);
    });
    const presentHtml = await present.text();
    expect(presentHtml).toContain("Suporte no WhatsApp");
    expect(presentHtml).toContain('href="https://wa.me/5511912345678"');
    expect(presentHtml).toContain('rel="noopener noreferrer"');
  });

  it("não reenvia o aceite se o POST original não tinha o consentimento válido", async () => {
    const request = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-dest": "document",
      },
      body: new URLSearchParams({ returnTo: "/dashboard", autoRefundAck: "off", consentVersion: "<script>alert(1)</script>" }),
    });
    const response = await respondMercadoPagoConnect(request, async () => {
      throw new Error(leak);
    });
    const html = await response.text();
    expect(html).toContain('method="post"');
    expect(html).not.toContain('name="autoRefundAck"');
    expect(html).not.toContain("consentVersion");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("&lt;script");
  });

  it("escapa o id do negócio e ignora returnTo externo", async () => {
    const hostileId = '"><img src=x onerror=alert(1)>';
    const request = new Request(`https://app.example.com/api/businesses/${encodeURIComponent(hostileId)}/mercadopago/connect`, {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-dest": "document",
      },
      body: new URLSearchParams({
        returnTo: "https://evil.test/phish?<script>",
        autoRefundAck: "on",
        consentVersion: MP_CONNECT_CONSENT_VERSION,
      }),
    });
    const response = await respondMercadoPagoConnect(request, async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", leak);
    });
    const html = await response.text();
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain(`action="/api/businesses/${encodeURIComponent(hostileId)}/mercadopago/connect"`);
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  it("mantém o JSON do contrato quando o cliente pede application/json", async () => {
    const request = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/dashboard", autoRefundAck: "on", consentVersion: MP_CONNECT_CONSENT_VERSION }),
    });
    const response = await respondMercadoPagoConnect(request, async () => {
      throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off.");
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: { code: "mp_oauth_pkce_invalid", message: "MP_OAUTH_PKCE deve ser on ou off." },
    });
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-CONFIG cause=mp_oauth_pkce_invalid");
  });

  it("não troca o 303 de sucesso nem o 401", async () => {
    const success = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      return NextResponse.redirect("https://auth.mercadopago.com/authorization?state=abc", 303);
    });
    expect(success.status).toBe(303);
    expect(success.headers.get("location")).toBe("https://auth.mercadopago.com/authorization?state=abc");
    expect(errorLog).not.toHaveBeenCalled();

    errorLog.mockClear();
    const denied = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    });
    expect(denied.status).toBe(401);
    await expect(denied.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Entre na sua conta para continuar." },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("não ecoa o código interno que veio no returnTo da página de erro antiga", async () => {
    const echoed = await respondMercadoPagoConnect(
      formRequest("/onboarding?reason=mp_oauth_pkce_invalid"),
      async () => { throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."); },
    );
    const html = await echoed.text();
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain('value="/onboarding?reason=mp_oauth_pkce_invalid"');
    expect(html).not.toContain("MP_OAUTH_PKCE");
    expect(html).not.toContain("deve ser on ou off");
    expect(html).toContain("Código: MP-CONFIG");
  });

  it("mantém a página anterior no callback", async () => {
    const request = new Request("https://app.example.com/api/integrations/mercadopago/callback?code=abc&state=xyz", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    });
    const response = await respondMercadoPagoConnect(request, async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", `${MP_CONNECT_CONFIG_COPY} ${leak}`);
    });
    expect(response.status).toBe(503);
    const html = await response.text();
    expect(html).toContain("Conexão indisponível");
    expect(html).toContain(MP_CONNECT_CONFIG_COPY);
    expect(html).not.toContain(MP_CONNECT_FAILURE_TITLE);
    expect(html).not.toContain(leak);
    expect(html).not.toContain("postgres://");
  });

  it("liga o formulário e o callback na mesma resposta de navegação", () => {
    expect(readFileSync(connectRoute, "utf8")).toContain("respondMercadoPagoConnect");
    expect(readFileSync(callbackRoute, "utf8")).toContain("respondMercadoPagoConnect");
  });
});
