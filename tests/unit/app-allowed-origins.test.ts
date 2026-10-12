import { afterEach, describe, expect, it, vi } from "vitest";
import { assertProductionSafeEnv, assertVercelProductionBuild } from "../../lib/env";
import { MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import { acceptMercadoPagoConsent, submitMercadoPagoConnect } from "../../lib/mercadopago-oauth/flow";
import { logRejectedAppOrigin, resetRejectedOriginLog } from "../../lib/app-origins";
import { requireAppOrigin, trustedAppOrigins } from "../../lib/origins";

const businessId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-10-08T12:00:00.000Z");
const key = "ab".repeat(32);
const bookingAccess = "booking-access-secret-32-chars-dddd";
const authSecret = "c".repeat(40);
const canonical = "https://www.agendapix.dev.br";
const apex = "https://agendapix.dev.br";

const connectEnv = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: "mp-client-secret",
  MP_OAUTH_REDIRECT_URI: "https://www.agendapix.dev.br/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: key,
  BETTER_AUTH_URL: canonical,
  BETTER_AUTH_SECRET: authSecret,
  NODE_ENV: "production",
};

const productionBuild = {
  VERCEL_ENV: "production",
  MP_OAUTH_PKCE: "on",
  BOOKING_ACCESS_SECRET: bookingAccess,
  BETTER_AUTH_SECRET: authSecret,
  SUPPORT_WHATSAPP_NUMBER: "5511912345678",
  SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "1",
};

function connect(headers: HeadersInit, env: Record<string, string | undefined> = connectEnv) {
  return submitMercadoPagoConnect({
    request: new Request("https://www.agendapix.dev.br/api/businesses/x/mercadopago/connect", {
      method: "POST",
      headers,
      body: JSON.stringify({ autoRefundAck: true, consentVersion: MP_CONNECT_CONSENT_VERSION }),
    }),
    businessId,
    ownerId: "owner",
    now,
    env,
    store: createMemoryMpStore(),
  });
}

const forbidden = { kind: "json", status: 403, body: { error: { code: "forbidden_origin" } } };

describe("allowlist de origem do app", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("recusa Origin ausente, vazio, null e Referer sem Origin", async () => {
    expect(await connect({})).toEqual(forbidden);
    expect(await connect({ origin: "" })).toEqual(forbidden);
    expect(await connect({ origin: "null" })).toEqual(forbidden);
    expect(await connect({ referer: "https://www.agendapix.dev.br/dashboard" })).toEqual(forbidden);
    expect(await connect({ origin: "null", referer: "https://www.agendapix.dev.br/dashboard" })).toEqual(forbidden);
    expect(await connect({ origin: "null", "sec-fetch-site": "same-origin", "content-type": "application/json" })).toEqual(forbidden);
    const consent = await acceptMercadoPagoConsent({
      request: new Request("https://www.agendapix.dev.br/api/businesses/x/mercadopago/consent", {
        method: "POST",
        headers: { origin: "null", "sec-fetch-site": "same-origin", "content-type": "application/json" },
        body: JSON.stringify({ autoRefundAck: true, consentVersion: MP_CONNECT_CONSENT_VERSION }),
      }),
      businessId,
      ownerId: "owner",
      now,
      env: connectEnv,
      store: createMemoryMpStore(),
    });
    expect(consent).toMatchObject({ kind: "error", status: 403, body: { error: { code: "forbidden_origin" } } });
  });

  it("aceita www e o apex e recusa sufixo, http e host alheio", async () => {
    const www = await connect({ origin: canonical, "content-type": "application/json" });
    expect(www.kind).toBe("redirect");
    const bare = await connect({ origin: apex, "content-type": "application/json" });
    expect(bare.kind).toBe("redirect");
    expect(await connect({ origin: "https://agendapix.dev.br.atacante.com" })).toEqual(forbidden);
    expect(await connect({ origin: "https://www.agendapix.dev.br.evil.com" })).toEqual(forbidden);
    expect(await connect({ origin: "http://www.agendapix.dev.br" })).toEqual(forbidden);
    expect(await connect({ origin: "https://agendapix.dev.br.atacante.com/www.agendapix.dev.br" })).toEqual(forbidden);
  });

  it("aceita origem extra da allowlist e o mesmo par no requireAppOrigin", async () => {
    const extra = "https://parceiro.example";
    const env = { ...connectEnv, APP_ALLOWED_ORIGINS: `${extra}/painel` };
    expect(trustedAppOrigins(env)).toEqual([canonical, apex, extra]);
    const allowed = await connect({ origin: extra, "content-type": "application/json" }, env);
    expect(allowed.kind).toBe("redirect");
    expect(await connect({ origin: "https://parceiro.example.evil.com" }, env)).toEqual(forbidden);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", apex);
    vi.stubEnv("BETTER_AUTH_SECRET", authSecret);
    expect(requireAppOrigin(new Request("https://agendapix.dev.br/api/onboarding", { headers: { origin: canonical } }))).toBe(canonical);
    expect(() => requireAppOrigin(new Request("https://agendapix.dev.br/api/onboarding", {
      headers: { referer: canonical },
    }))).toThrow(expect.objectContaining({ status: 403, code: "origin_not_allowed" }));
  });

  it("em VERCEL_ENV=production recusa *.vercel.app e o que não é https, citando o item", () => {
    const secret = "super-secret-token";
    expect(() => assertVercelProductionBuild({
      ...productionBuild,
      APP_ALLOWED_ORIGINS: "*.vercel.app",
    })).toThrow('APP_ALLOWED_ORIGINS não é aceito com VERCEL_ENV=production: "https://*.vercel.app" (host .vercel.app).');
    expect(() => assertVercelProductionBuild({
      ...productionBuild,
      APP_ALLOWED_ORIGINS: "https://agenda-git-feat.vercel.app",
    })).toThrow(/"https:\/\/agenda-git-feat\.vercel\.app" \(host \.vercel\.app\)/);
    expect(() => assertProductionSafeEnv({
      VERCEL_ENV: "production",
      APP_ALLOWED_ORIGINS: "http://www.agendapix.dev.br",
    })).toThrow('APP_ALLOWED_ORIGINS não é aceito com VERCEL_ENV=production: "http://www.agendapix.dev.br" (não é https).');
    try {
      assertVercelProductionBuild({
        ...productionBuild,
        APP_ALLOWED_ORIGINS: `https://user:${secret}@preview.vercel.app`,
      });
      throw new Error("deveria falhar");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("https://preview.vercel.app");
      expect(message).not.toContain(secret);
      expect(message).not.toContain("user:");
    }
    expect(() => assertVercelProductionBuild({
      ...productionBuild,
      APP_ALLOWED_ORIGINS: "https://notvercel.app, https://vercel.app.evil.com",
    })).not.toThrow();
    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "preview",
      MP_OAUTH_PKCE: "off",
      BOOKING_ACCESS_SECRET: bookingAccess,
      BETTER_AUTH_SECRET: authSecret,
      APP_ALLOWED_ORIGINS: "https://agenda-git-feat.vercel.app",
    })).not.toThrow();
  });

  it("avisa item inválido no boot sem repetir o valor", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const leaked = "not-a-url-super-secret-token";
    expect(() => assertProductionSafeEnv({ APP_ALLOWED_ORIGINS: ` , ${leaked}, ` })).not.toThrow();
    expect(warn).toHaveBeenCalledWith("APP_ALLOWED_ORIGINS: 1 item inválido ignorado.");
    expect(warn.mock.calls.map((call) => JSON.stringify(call)).join("\n")).not.toContain(leaked);
  });

  it("trunca origin_received em 200 caracteres e não leva cookie nem segredo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const marker = "UNIQUE_TAIL_MARKER_SHOULD_NOT_APPEAR";
    const cookie = "session=super-secret-cookie";
    const raw = `https://${"a".repeat(250)}${marker}`;
    expect(raw.length).toBeGreaterThan(200);
    expect(await connect({
      origin: raw,
      cookie,
      authorization: "Bearer super-secret-token",
    })).toEqual(forbidden);
    const payload = originLogs(warn)[0];
    expect(payload.event).toBe("forbidden_origin");
    expect(payload.origin_received).toHaveLength(200);
    expect(payload.origin_received).toBe(raw.slice(0, 200));
    expect(payload.origin_received).not.toContain(marker);
    expect(payload.allowed_origins).toEqual([canonical, apex]);
    expect(payload.suppressed).toBe(0);
    const serialized = JSON.stringify(warn.mock.calls);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain(marker);
  });

  it("não loga Origin ausente e amostra 1 warn por origem a cada 60s", async () => {
    resetRejectedOriginLog();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T12:00:00.000Z"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await connect({})).toEqual(forbidden);
      expect(originLogs(warn)).toEqual([]);

      expect(await connect({ origin: "https://evil.example" })).toEqual(forbidden);
      expect(await connect({ origin: "https://evil.example" })).toEqual(forbidden);
      expect(await connect({ origin: "https://evil.example" })).toEqual(forbidden);
      vi.setSystemTime(new Date("2026-10-11T12:00:59.000Z"));
      expect(await connect({ origin: "https://evil.example" })).toEqual(forbidden);
      expect(originLogs(warn)).toEqual([{
        event: "forbidden_origin",
        origin_received: "https://evil.example",
        allowed_origins: [canonical, apex],
        suppressed: 0,
      }]);

      vi.setSystemTime(new Date("2026-10-11T12:01:00.000Z"));
      expect(await connect({ origin: "https://evil.example" })).toEqual(forbidden);
      expect(originLogs(warn)[1]).toEqual({
        event: "forbidden_origin",
        origin_received: "https://evil.example",
        allowed_origins: [canonical, apex],
        suppressed: 3,
      });

      expect(await connect({ origin: "https://outro.example" })).toEqual(forbidden);
      expect(originLogs(warn)[2]).toMatchObject({
        origin_received: "https://outro.example",
        allowed_origins: [canonical, apex],
        suppressed: 0,
      });
    } finally {
      vi.useRealTimers();
      resetRejectedOriginLog();
    }
  });

  it("guarda no máximo 100 origens e ainda avisa uma origem nova", () => {
    resetRejectedOriginLog();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const allowed = ["https://www.agendapix.dev.br"];
    try {
      for (let index = 0; index < 100; index += 1) logRejectedAppOrigin(`https://evil-${index}.example`, allowed, 0);
      expect(originLogs(warn)).toHaveLength(100);
      logRejectedAppOrigin("https://evil-0.example", allowed, 1_000);
      expect(originLogs(warn)).toHaveLength(100);
      logRejectedAppOrigin("https://nova.example", allowed, 1_000);
      expect(originLogs(warn)).toHaveLength(101);
      expect(originLogs(warn).at(-1)).toMatchObject({
        origin_received: "https://nova.example",
        allowed_origins: allowed,
        suppressed: 0,
      });
    } finally {
      resetRejectedOriginLog();
    }
  });
});

function originLogs(warn: { mock: { calls: unknown[][] } }) {
  return warn.mock.calls.map((call) => call[0]).filter((value): value is {
    event: string;
    origin_received: string;
    allowed_origins: string[];
    suppressed: number;
  } => typeof value === "object" && value !== null && "origin_received" in value);
}
