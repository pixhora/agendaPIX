import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http";
import { MP_CONNECT_CONFIG_COPY, ownerConnectConfigCopy, respondMercadoPagoConnect } from "../../lib/mercadopago/connect-navigation";

const connectRoute = resolve(process.cwd(), "app/api/businesses/[businessId]/mercadopago/connect/route.ts");
const callbackRoute = resolve(process.cwd(), "app/api/integrations/mercadopago/callback/route.ts");

function formRequest(returnTo: string, accept = "text/html,application/xhtml+xml") {
  return new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
    method: "POST",
    headers: {
      accept,
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
    },
    body: new URLSearchParams({ returnTo, autoRefundAck: "on", consentVersion: "2026-10-09.v4" }),
  });
}

describe("navegação do connect com mp_oauth_pkce_invalid", () => {
  it("mostra a frase genérica de configuração e esconde o código", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/onboarding"), async () => {
      throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off.");
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain(MP_CONNECT_CONFIG_COPY);
    expect(html).toContain("Conexão indisponível");
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain("min-height: 44px");
    expect(html).not.toContain("mp_oauth_pkce_invalid");
    expect(html).not.toContain("MP_OAUTH_PKCE");
    expect(html).not.toContain("deve ser on ou off");
    expect(ownerConnectConfigCopy("mp_oauth_pkce_invalid")).toBe(MP_CONNECT_CONFIG_COPY);
    expect(ownerConnectConfigCopy("mp_oauth_unconfigured")).toBe(MP_CONNECT_CONFIG_COPY);
  });

  it("trata o modo inválido como a configuração ausente", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", MP_CONNECT_CONFIG_COPY);
    });
    const html = await response.text();
    expect(html).toContain(MP_CONNECT_CONFIG_COPY);
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("mp_oauth_unconfigured");
  });

  it("mantém o JSON do contrato quando o cliente pede application/json", async () => {
    const request = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/dashboard", autoRefundAck: "on", consentVersion: "2026-10-09.v4" }),
    });
    const response = await respondMercadoPagoConnect(request, async () => {
      throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off.");
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: { code: "mp_oauth_pkce_invalid", message: "MP_OAUTH_PKCE deve ser on ou off." },
    });
  });

  it("não troca o 303 de sucesso", async () => {
    const success = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      return NextResponse.redirect("https://auth.mercadopago.com/authorization?state=abc", 303);
    });
    expect(success.status).toBe(303);
    expect(success.headers.get("location")).toBe("https://auth.mercadopago.com/authorization?state=abc");
  });

  it("manda o formulário com sessão expirada para o login, com volta ao onboarding", async () => {
    const denied = await respondMercadoPagoConnect(formRequest("/onboarding"), async () => {
      throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    });
    expect(denied.status).toBe(303);
    expect(denied.headers.get("location")).toBe("https://app.example.com/login?next=%2Fonboarding");
    expect(denied.headers.get("cache-control")).toBe("no-store");
    const body = await denied.text();
    expect(body).not.toContain("unauthorized");
    expect(body).not.toContain("Entre na sua conta");

    const fromReceipt = await respondMercadoPagoConnect(formRequest("/onboarding/recebimento"), async () => {
      throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    });
    expect(fromReceipt.headers.get("location")).toBe("https://app.example.com/login?next=%2Fonboarding");
  });

  it("mantém o 401 em JSON quando o cliente não é o formulário", async () => {
    const request = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/onboarding", autoRefundAck: "on", consentVersion: "2026-10-09.v4" }),
    });
    const denied = await respondMercadoPagoConnect(request, async () => {
      throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    });
    expect(denied.status).toBe(401);
    await expect(denied.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Entre na sua conta para continuar." },
    });
  });

  it("ignora returnTo externo e não ecoa o código na página", async () => {
    const external = await respondMercadoPagoConnect(
      formRequest("https://evil.test/phish"),
      async () => { throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."); },
    );
    const externalHtml = await external.text();
    expect(externalHtml).toContain('href="/dashboard"');
    expect(externalHtml).not.toContain("evil.test");

    const echoed = await respondMercadoPagoConnect(
      formRequest("/onboarding?reason=mp_oauth_pkce_invalid"),
      async () => { throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."); },
    );
    const echoedHtml = await echoed.text();
    expect(echoedHtml).toContain('href="/onboarding"');
    expect(echoedHtml).not.toContain("mp_oauth_pkce_invalid");
  });

  it("liga o formulário e o callback na mesma resposta de navegação", () => {
    expect(readFileSync(connectRoute, "utf8")).toContain("respondMercadoPagoConnect");
    expect(readFileSync(callbackRoute, "utf8")).toContain("respondMercadoPagoConnect");
  });
});
