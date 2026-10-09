import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { MpConnectUnavailable } from "../../components/payments/mp-connect-unavailable";
import { HttpError } from "../../lib/http";
import { MP_CONNECT_UNAVAILABLE_COPY, ownerConnectConfigCopy, respondMercadoPagoConnect } from "../../lib/mercadopago/connect-navigation";

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
    body: new URLSearchParams({ returnTo, autoRefundAck: "on", consentVersion: "2026-10-08.v3.2" }),
  });
}

describe("navegação do connect com mp_oauth_pkce_invalid", () => {
  it("manda o dono para a página do app, sem o código", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/onboarding"), async () => {
      throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off.");
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const location = response.headers.get("location") ?? "";
    expect(location).toBe("https://app.example.com/mercadopago/indisponivel?returnTo=%2Fonboarding");
    expect(location).not.toContain("mp_oauth_pkce_invalid");
    expect(location).not.toContain("MP_OAUTH_PKCE");
    expect(ownerConnectConfigCopy("mp_oauth_pkce_invalid")).toBe(MP_CONNECT_UNAVAILABLE_COPY);
    expect(ownerConnectConfigCopy("mp_oauth_unconfigured")).toBe(MP_CONNECT_UNAVAILABLE_COPY);
  });

  it("usa a marca, a pílula e a frase nova", () => {
    const html = renderToStaticMarkup(createElement(MpConnectUnavailable, { backHref: "/onboarding" }));
    expect(html).toContain("Conexão indisponível");
    expect(html).toContain(MP_CONNECT_UNAVAILABLE_COPY);
    expect(html).toContain(">Voltar<");
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain("rounded-full");
    expect(html).toContain("Agenda");
    expect(html).toContain("Pix");
    expect(html).toContain("font-display");
    expect(html).not.toContain("mp_oauth_pkce_invalid");
    expect(html).not.toContain("MP_OAUTH_PKCE");
    expect(html).not.toContain("A conexão com o Mercado Pago ainda não está configurada.");
  });

  it("trata o modo inválido como a configuração ausente", async () => {
    const response = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
    });
    expect(response.headers.get("location")).toBe("https://app.example.com/mercadopago/indisponivel?returnTo=%2Fdashboard");
    expect(response.headers.get("location")).not.toContain("mp_oauth_unconfigured");
  });

  it("mantém o JSON do contrato quando o cliente pede application/json", async () => {
    const request = new Request("https://app.example.com/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/dashboard", autoRefundAck: "on", consentVersion: "2026-10-08.v3.2" }),
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

  it("não troca o 303 de sucesso nem outros erros", async () => {
    const success = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
      return NextResponse.redirect("https://auth.mercadopago.com/authorization?state=abc", 303);
    });
    expect(success.status).toBe(303);
    expect(success.headers.get("location")).toBe("https://auth.mercadopago.com/authorization?state=abc");

    const denied = await respondMercadoPagoConnect(formRequest("/dashboard"), async () => {
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
    expect(external.headers.get("location")).toBe("https://app.example.com/mercadopago/indisponivel?returnTo=%2Fdashboard");
    expect(external.headers.get("location")).not.toContain("evil.test");

    const echoed = await respondMercadoPagoConnect(
      formRequest("/onboarding?reason=mp_oauth_pkce_invalid"),
      async () => { throw new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."); },
    );
    const echoedLocation = echoed.headers.get("location") ?? "";
    expect(echoedLocation).toBe("https://app.example.com/mercadopago/indisponivel?returnTo=%2Fonboarding");
    expect(echoedLocation).not.toContain("mp_oauth_pkce_invalid");
  });

  it("liga o formulário e o callback na mesma resposta de navegação", () => {
    expect(readFileSync(connectRoute, "utf8")).toContain("respondMercadoPagoConnect");
    expect(readFileSync(callbackRoute, "utf8")).toContain("respondMercadoPagoConnect");
  });
});
