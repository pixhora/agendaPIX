import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, json } from "../../lib/http";
import { MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import {
  classifyConnectFailure,
  classifyConnectResult,
  formatConnectFailureLog,
  MpConnectFailure,
  MpConnectFailureCode,
  MP_CONNECT_FAILURE_CODES,
} from "../../lib/mercadopago/connect-failure";
import { MP_CONNECT_FAILURE_BODY, MP_CONNECT_FAILURE_TITLE, respondMercadoPagoConnect } from "../../lib/mercadopago/connect-navigation";
import { submitMercadoPagoConnect } from "../../lib/mercadopago-oauth/flow";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  errorLog.mockClear();
});

const leak = {
  databaseUrl: "postgres://agenda:s3cret@db.internal:5432/agendapix",
  clientSecret: "mp-client-secret-do-not-leak",
  oauthCode: "TG-authorization-code-9988",
  oauthState: "oauth-state-value-xyz",
  token: "APP_USR-super-secret-token",
};

function nastyMessage() {
  return `falha ${leak.databaseUrl} client_secret=${leak.clientSecret} code=${leak.oauthCode} state=${leak.oauthState} token=${leak.token}`;
}

function assertNoLeak(value: string) {
  expect(value).not.toContain(leak.databaseUrl);
  expect(value).not.toContain(leak.clientSecret);
  expect(value).not.toContain(leak.oauthCode);
  expect(value).not.toContain(leak.oauthState);
  expect(value).not.toContain(leak.token);
  expect(value).not.toContain("client_secret");
  expect(value).not.toContain("postgres://");
  expect(value).not.toContain(`state=${leak.oauthState}`);
  expect(value).not.toContain(`code=${leak.oauthCode}`);
  expect(value).not.toContain("APP_USR");
}

const env = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: leak.clientSecret,
  MP_OAUTH_REDIRECT_URI: "https://app.example.com/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: "ab".repeat(32),
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: "c".repeat(40),
};

function connectRequest() {
  return new Request("https://app.example.com/api/businesses/biz/mercadopago/connect", {
    method: "POST",
    headers: {
      accept: "text/html",
      origin: "https://app.example.com",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "document",
    },
    body: new URLSearchParams({
      returnTo: "/dashboard",
      autoRefundAck: "on",
      consentVersion: MP_CONNECT_CONSENT_VERSION,
    }),
  });
}

describe("códigos fixos da falha do connect", () => {
  it("exporta só a lista fechada", () => {
    expect(MP_CONNECT_FAILURE_CODES).toEqual([
      "MP-ORIGIN",
      "MP-CONFIG",
      "MP-STATE",
      "MP-DB",
      "MP-UNKNOWN",
    ]);
    expect(Object.values(MpConnectFailureCode)).toEqual([...MP_CONNECT_FAILURE_CODES]);
  });

  it("mapeia origem, configuração, state, banco e o resto", () => {
    expect(classifyConnectFailure(new HttpError(403, "forbidden_origin", nastyMessage()))).toBe(MpConnectFailureCode.Origin);
    expect(classifyConnectFailure(new HttpError(503, "mp_oauth_unconfigured", nastyMessage()))).toBe(MpConnectFailureCode.Config);
    expect(classifyConnectFailure(new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."))).toBe(MpConnectFailureCode.Config);
    expect(classifyConnectFailure(new MpConnectFailure(MpConnectFailureCode.State, new Error(nastyMessage())))).toBe(MpConnectFailureCode.State);
    expect(classifyConnectFailure(new MpConnectFailure(MpConnectFailureCode.Database, new Error(nastyMessage())))).toBe(MpConnectFailureCode.Database);
    expect(classifyConnectFailure(Object.assign(new Error(nastyMessage()), { code: "23505" }))).toBe(MpConnectFailureCode.Database);
    expect(classifyConnectFailure(new Error(nastyMessage()))).toBe(MpConnectFailureCode.Unknown);
    expect(classifyConnectResult(403, { error: { code: "forbidden_origin", message: nastyMessage() } })).toBe(MpConnectFailureCode.Origin);
    expect(classifyConnectResult(503, { error: { code: "mp_oauth_pkce_invalid", message: nastyMessage() } })).toBe(MpConnectFailureCode.Config);
    expect(classifyConnectResult(400, { error: { code: "auto_refund_ack_required" } })).toBeNull();
  });

  it("registra o código e a causa sem segredo, URL, state ou token", () => {
    const cases: Array<[MpConnectFailureCode, unknown, string]> = [
      [MpConnectFailureCode.Origin, { error: { code: "forbidden_origin", message: nastyMessage() } }, "[mp-connect] code=MP-ORIGIN cause=forbidden_origin"],
      [MpConnectFailureCode.Config, new HttpError(503, "mp_oauth_unconfigured", nastyMessage()), "[mp-connect] code=MP-CONFIG cause=mp_oauth_unconfigured"],
      [MpConnectFailureCode.Config, new HttpError(503, "mp_oauth_pkce_invalid", "MP_OAUTH_PKCE deve ser on ou off."), "[mp-connect] code=MP-CONFIG cause=mp_oauth_pkce_invalid"],
      [MpConnectFailureCode.State, new MpConnectFailure(MpConnectFailureCode.State, Object.assign(new Error(nastyMessage()), { code: "23505" })), "[mp-connect] code=MP-STATE cause=oauth_state_write sqlstate=23505"],
      [MpConnectFailureCode.Database, Object.assign(new Error(nastyMessage()), { cause: { code: "57P01", message: leak.databaseUrl } }), "[mp-connect] code=MP-DB cause=database sqlstate=57P01"],
      [MpConnectFailureCode.Unknown, new Error(nastyMessage()), "[mp-connect] code=MP-UNKNOWN cause=unexpected"],
      [MpConnectFailureCode.Unknown, new HttpError(404, "business_unavailable", nastyMessage()), "[mp-connect] code=MP-UNKNOWN cause=business_unavailable"],
      [MpConnectFailureCode.Unknown, new HttpError(500, "client_secret", leak.clientSecret), "[mp-connect] code=MP-UNKNOWN cause=unexpected"],
    ];
    for (const [code, error, line] of cases) {
      const logged = formatConnectFailureLog(code, error);
      expect(logged).toBe(line);
      assertNoLeak(logged);
      expect(logged).not.toContain("deve ser on ou off");
    }
  });

  it("etiqueta falha ao gravar o state e erro de banco no POST", async () => {
    const stateStore = createMemoryMpStore();
    stateStore.saveOAuthState = async () => {
      throw Object.assign(new Error(nastyMessage()), { code: "23505" });
    };
    await expect(submitMercadoPagoConnect({
      request: connectRequest(),
      businessId: "biz",
      ownerId: "owner",
      env,
      store: stateStore,
    })).rejects.toMatchObject({ failureCode: MpConnectFailureCode.State });

    const dbStore = createMemoryMpStore();
    dbStore.findByBusinessId = async () => {
      throw new Error(nastyMessage());
    };
    await expect(submitMercadoPagoConnect({
      request: connectRequest(),
      businessId: "biz",
      ownerId: "owner",
      env,
      store: dbStore,
    })).rejects.toMatchObject({ failureCode: MpConnectFailureCode.Database });
  });

  it("mostra MP-STATE na página e não deixa a mensagem crua vazar", async () => {
    const store = createMemoryMpStore();
    store.saveOAuthState = async () => {
      throw Object.assign(new Error(nastyMessage()), { code: "23505" });
    };
    const request = connectRequest();
    const response = await respondMercadoPagoConnect(request, async () => {
      await submitMercadoPagoConnect({ request, businessId: "biz", ownerId: "owner", env, store });
      return json({ ok: true });
    });
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain(MP_CONNECT_FAILURE_TITLE);
    expect(html).toContain(MP_CONNECT_FAILURE_BODY);
    expect(html).toContain("Código: MP-STATE");
    expect(html).not.toContain("23505");
    assertNoLeak(html);
    expect(errorLog).toHaveBeenCalledWith("[mp-connect] code=MP-STATE cause=oauth_state_write sqlstate=23505");
    expect(errorLog.mock.calls.flat().join("\n")).not.toContain(leak.databaseUrl);
  });
});
