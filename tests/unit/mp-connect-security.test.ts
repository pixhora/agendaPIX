import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MP_USERS_ME_URL } from "../../lib/mercadopago-oauth/account-profile";
import { handleMpConnectWebhook, mercadoPagoManifest } from "../../lib/mercadopago-oauth/connect-webhook";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { createMemoryMpStore } from "../../lib/mercadopago-oauth/memory-store";
import type { MpConnection } from "../../lib/mercadopago-oauth/types";
import { createDrizzleWebhookEvents, createMemoryWebhookEvents, mpConnectRequestId, WEBHOOK_EVENT_RETENTION_DAYS, type WebhookEventPort } from "../../lib/mercadopago-oauth/webhook-events";

const businessId = "11111111-1111-4111-8111-111111111111";
const key = "ab".repeat(32);
const webhookSecret = "d".repeat(40);
const env = {
  MP_CLIENT_ID: "mp-client",
  MP_CLIENT_SECRET: "mp-client-secret",
  MP_OAUTH_REDIRECT_URI: "https://app.example.com/api/integrations/mercadopago/callback",
  MP_TOKEN_ENCRYPTION_KEY: key,
  BETTER_AUTH_URL: "https://app.example.com",
  BETTER_AUTH_SECRET: "c".repeat(40),
  MERCADOPAGO_WEBHOOK_SECRET: webhookSecret,
};

function connection(): MpConnection {
  return {
    businessId,
    mpUserId: "4242",
    accessTokenEnc: encryptMpToken("seller-access", businessId, "access", key),
    refreshTokenEnc: encryptMpToken("seller-refresh", businessId, "refresh", key),
    publicKey: "public-test",
    scope: "read write offline_access",
    liveMode: false,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    refreshedAt: null,
    status: "connected",
    lastError: null,
    disconnectedAt: null,
    consentVersion: null,
    consentTextSha256: null,
    autoRefundAckAt: null,
    consentUserId: null,
    accountDisplayName: null,
    accountEmailMasked: null,
  };
}

function signed(requestId: string | null, body: string) {
  const dataId = "abc123";
  const ts = "1700000000";
  const manifest = mercadoPagoManifest({ dataId, requestId, ts });
  const signature = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  const headers = new Headers({ "x-signature": `ts=${ts},v1=${signature}` });
  if (requestId) headers.set("x-request-id", requestId);
  return {
    body,
    headers,
    url: `https://app.example.com/api/webhooks/payments/mercadopago?data.id=${dataId}&type=mp-connect`,
    now: new Date(Number(ts) * 1000),
  };
}

const deauthorizedBody = JSON.stringify({ action: "application.deauthorized", type: "mp-connect", user_id: "4242" });

function harness(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> = async () => new Response(null, { status: 401 })) {
  const store = createMemoryMpStore([connection()]);
  let marks = 0;
  const events = createMemoryWebhookEvents(async (mpUserId) => {
    marks += 1;
    return store.markDeauthorized(mpUserId);
  });
  const calls: string[] = [];
  return {
    store,
    events,
    marks: () => marks,
    calls,
    run: (requestId: string | null, body = deauthorizedBody, override?: typeof fetchImpl) => handleMpConnectWebhook({
      ...signed(requestId, body),
      env,
      store,
      events,
      revocationTimeoutMs: 20,
      fetchImpl: async (url, init) => {
        calls.push(url);
        return (override ?? fetchImpl)(url, init);
      },
    }),
  };
}

describe("mp-connect não desconecta sem confirmação nem dedupe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("401 em GET /users/me desconecta uma vez; o replay não chama o Mercado Pago de novo", async () => {
    const hook = harness(async (url, init) => {
      expect(url).toBe(MP_USERS_ME_URL);
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer seller-access");
      return new Response(null, { status: 401 });
    });
    expect(await hook.run("req-revoke")).toEqual({ outcome: "deauthorized" });
    expect((await hook.store.findByBusinessId(businessId))?.status).toBe("needs_reconnect");
    expect((await hook.store.findByBusinessId(businessId))?.accessTokenEnc).toBeNull();
    expect(await hook.run("req-revoke")).toEqual({ outcome: "duplicate" });
    expect(hook.marks()).toBe(1);
    expect(hook.calls).toEqual([MP_USERS_ME_URL]);
  });

  it("invalid_grant desconecta; token ainda válido, 5xx, timeout e rede não desconectam", async () => {
    const granted = harness(async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(await granted.run("req-grant")).toEqual({ outcome: "deauthorized" });
    expect((await granted.store.findByBusinessId(businessId))?.status).toBe("needs_reconnect");

    const active = harness(async () => Response.json({ id: 4242 }));
    expect(await active.run("req-active")).toEqual({ outcome: "ignored", reason: "authorization_still_active" });
    expect((await active.store.findByBusinessId(businessId))?.status).toBe("connected");
    expect(await active.run("req-active")).toEqual({ outcome: "duplicate" });
    expect(active.calls).toEqual([MP_USERS_ME_URL]);

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [requestId, fetchImpl] of [
      ["req-500", async () => new Response("upstream", { status: 503 })],
      ["req-grant-500", async () => Response.json({ error: "invalid_grant" }, { status: 500 })],
      ["req-grant-402", async () => Response.json({ error: "invalid_grant" }, { status: 402 })],
      ["req-timeout", (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })],
      ["req-network", async () => { throw new TypeError("fetch failed"); }],
      ["req-forbidden", async () => Response.json({ error: "forbidden" }, { status: 403 })],
    ] as const) {
      const hook = harness();
      await expect(hook.run(requestId, deauthorizedBody, fetchImpl)).rejects.toMatchObject({
        status: 503,
        code: "mp_revocation_unconfirmed",
      });
      expect((await hook.store.findByBusinessId(businessId))?.status).toBe("connected");
      expect(hook.marks()).toBe(0);
      expect(hook.calls).toEqual([MP_USERS_ME_URL]);
    }
    const logged = errorLog.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("code=http_503");
    expect(logged).toContain("code=http_500");
    expect(logged).toContain("code=http_402");
    expect(logged).toContain("code=timeout");
    expect(logged).toContain("code=unreachable");
    expect(logged).toContain("code=http_403");
    expect(logged).not.toContain("seller-access");
    expect(logged).not.toContain("seller-refresh");
  });

  it("assinatura inválida e request id ausente não deduplicam nem desconectam", async () => {
    const hook = harness();
    const events: WebhookEventPort = {
      seen: async () => { throw new Error("dedupe antes da assinatura"); },
      record: async () => { throw new Error("dedupe antes da assinatura"); },
      deauthorize: async () => { throw new Error("dedupe antes da assinatura"); },
    };
    const forged = signed("req-forged", deauthorizedBody);
    forged.headers.set("x-signature", "ts=1700000000,v1=00");
    await expect(handleMpConnectWebhook({
      ...forged,
      env,
      store: hook.store,
      events,
      fetchImpl: async () => { throw new Error("nao devia chamar o MP"); },
    })).rejects.toMatchObject({ status: 401, code: "invalid_signature" });
    expect((await hook.store.findByBusinessId(businessId))?.status).toBe("connected");

    await expect(hook.run(null)).rejects.toMatchObject({ status: 400, code: "invalid_event" });
    expect(hook.calls).toEqual([]);
    expect(hook.marks()).toBe(0);
    expect((await hook.store.findByBusinessId(businessId))?.accessTokenEnc).toContain("v1.");
    expect(mpConnectRequestId("  req-ok  ")).toBe("req-ok");
    expect(mpConnectRequestId("")).toBeNull();
    expect(mpConnectRequestId("a".repeat(129))).toBeNull();
    expect(mpConnectRequestId("req\nid")).toBeNull();
  });
});

describe("webhook_events grava o efeito na mesma transação", () => {
  it("conflito não desautoriza de novo e falha do efeito não consome o request id", async () => {
    const rows = new Set<string>();
    let updates = 0;
    const db = {
      select() {
        return {
          from: () => ({
            where: (condition: unknown) => ({
              limit: async () => {
                const found = new Set<string>();
                const visited = new Set<unknown>();
                const visit = (node: unknown) => {
                  if (typeof node === "string") {
                    if (rows.has(node)) found.add(node);
                    return;
                  }
                  if (!node || typeof node !== "object" || visited.has(node)) return;
                  visited.add(node);
                  for (const child of Object.values(node)) visit(child);
                };
                visit(condition);
                return [...found].map((requestId) => ({ requestId }));
              },
            }),
          }),
        };
      },
      async transaction<T>(run: (tx: {
        insert: () => { values: (value: { requestId: string }) => { onConflictDoNothing: () => { returning: () => Promise<Array<{ requestId: string }>> } } };
        update: () => { set: () => { where: () => { returning: () => Promise<Array<{ businessId: string }>> } } };
      }) => Promise<T>) {
        const snapshot = new Set(rows);
        const updatesBefore = updates;
        let staged: string | null = null;
        try {
          return await run({
            insert: () => ({
              values: (value) => ({
                onConflictDoNothing: () => ({
                  returning: async () => {
                    if (rows.has(value.requestId) || staged === value.requestId) return [];
                    staged = value.requestId;
                    rows.add(value.requestId);
                    return [{ requestId: value.requestId }];
                  },
                }),
              }),
            }),
            update: () => ({
              set: () => ({
                where: () => ({
                  returning: async () => {
                    updates += 1;
                    if (updates === 2) throw new Error("db down");
                    return [{ businessId }];
                  },
                }),
              }),
            }),
          });
        } catch (error) {
          rows.clear();
          for (const id of snapshot) rows.add(id);
          updates = updatesBefore;
          throw error;
        }
      },
    };
    const events = createDrizzleWebhookEvents(db as never);
    expect(await events.deauthorize("req-1", "4242")).toEqual({ kind: "applied", businessIds: [businessId] });
    expect(updates).toBe(1);
    expect(await events.deauthorize("req-1", "4242")).toEqual({ kind: "duplicate" });
    expect(updates).toBe(1);
    expect(await events.seen("req-1")).toBe(true);
    await expect(events.deauthorize("req-2", "4242")).rejects.toThrow("db down");
    expect(await events.seen("req-2")).toBe(false);
    expect(updates).toBe(1);
    expect(WEBHOOK_EVENT_RETENTION_DAYS).toBe(30);
  });
});
