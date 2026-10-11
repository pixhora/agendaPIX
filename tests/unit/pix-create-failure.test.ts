import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoPaymentProvider } from "../../lib/payments/mercadopago";
import {
  causeCodesFromMpBody,
  classifyPixCreateRefusal,
  formatPixCreateLog,
  PixCreateRefusedError,
} from "../../lib/payments/pix-create-log";
import { redactOAuthReturnLog } from "../../lib/onboarding/oauth-return";

const accessToken = "TEST-access-token-not-real";
const webhookSecret = "test-only-mercadopago-webhook-secret-32chars";
const now = new Date("2030-01-01T12:00:00.000Z");
const businessId = "11111111-1111-4111-8111-111111111111";
const leakedToken = "APP_USR-1234567890abcdef-secret";
const leakedEmail = "maria.silva@example.com";

const leakyBody = JSON.stringify({
  message: `pagador ${leakedEmail} token ${leakedToken}`,
  error: "bad_request",
  status: 400,
  cause: [
    {
      code: 4037,
      description: `Invalid transaction_amount ${leakedToken} ${leakedEmail}`,
      data: `Authorization: Bearer ${leakedToken}?code=${leakedToken}&state=oauth-state`,
    },
    { code: leakedToken, description: leakedEmail },
    { code: "APP_USR-should-not-log", description: "nope" },
  ],
});

function provider(fetchImpl: (input: string, init?: RequestInit) => Promise<Response>) {
  return new MercadoPagoPaymentProvider({
    accessToken,
    webhookSecret,
    baseUrl: "https://api.mercadopago.com",
    notificationUrl: "https://example.test/api/webhooks/payments/mercadopago",
    fetchImpl,
    now: () => now,
  });
}

function chargeInput(reference = randomUUID()) {
  return {
    idempotencyKey: randomUUID(),
    reference,
    amountCents: 1000,
    expiresAt: new Date(now.getTime() + 40 * 60_000),
    customer: { name: "Cliente Teste Silva", phone: "+5511999999999", email: leakedEmail },
  };
}

function mockFetch(post: () => Promise<Response> | Response) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/v1/payments/search") {
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if ((init?.method ?? "GET") === "POST" && url.pathname === "/v1/payments") return post();
    return new Response(JSON.stringify({ message: leakedToken }), { status: 500 });
  });
}

function warnLines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((call) => call.map((part) => String(part)).join(" ")).join("\n");
}

describe("recusa ao criar Pix", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifica só códigos publicados na referência de criar pagamento", () => {
    expect(classifyPixCreateRefusal(400, ["4037"])).toBe("mp_invalid_amount");
    expect(classifyPixCreateRefusal(400, ["4002", "4024"])).toBe("mp_invalid_amount");
    expect(classifyPixCreateRefusal(401, [])).toBe("mp_unauthorized");
    expect(classifyPixCreateRefusal(403, ["4"])).toBe("mp_unauthorized");
    expect(classifyPixCreateRefusal(400, ["3009"])).toBe("mp_unauthorized");
    expect(classifyPixCreateRefusal(400, ["pa_unauthorized_result_from_policies"])).toBe("mp_unauthorized");
    expect(classifyPixCreateRefusal(400, ["6033"])).toBe("mp_unknown");
    expect(classifyPixCreateRefusal(400, ["13253"])).toBe("mp_unknown");
  });

  it("não copia message, e-mail nem token do corpo para os cause codes", () => {
    expect(causeCodesFromMpBody(leakyBody)).toEqual(["4037"]);
  });

  it("passa a linha pelo redator e omite segredo que não cabe no campo", () => {
    const line = formatPixCreateLog({
      businessId,
      paymentId: "22222222-2222-4222-8222-222222222222",
      mpStatus: 400,
      causeCodes: ["4037", leakedToken],
      requestId: `req-1?code=${leakedToken}&state=abc`,
      reason: "mp_invalid_amount",
    });
    expect(line).toBe(redactOAuthReturnLog(line));
    expect(line).toContain("mp_status=400");
    expect(line).toContain("mp_cause=4037");
    expect(line).toContain("mp_request_id=-");
    expect(line).toContain("reason=mp_invalid_amount");
    expect(line).not.toContain(leakedToken);
    expect(line).not.toContain("APP_USR");
    expect(line).not.toContain("@");
  });

  it("loga status, cause code e x-request-id sem o corpo do Mercado Pago", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reference = randomUUID();
    const fetchImpl = mockFetch(() => new Response(leakyBody, {
      status: 400,
      headers: { "content-type": "application/json", "x-request-id": "req-abc-123" },
    }));
    const mp = provider(fetchImpl);
    await expect(mp.createPixCharge(chargeInput(reference), { businessId })).rejects.toBeInstanceOf(PixCreateRefusedError);
    const logs = `${warnLines(warn)}\n${warnLines(errorSpy)}`;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(logs).toContain(`[pix-create] business=${businessId} payment=${reference} mp_status=400 mp_cause=4037 mp_request_id=req-abc-123 reason=mp_invalid_amount`);
    expect(logs).not.toContain(leakedToken);
    expect(logs).not.toContain("APP_USR");
    expect(logs).not.toContain(leakedEmail);
    expect(logs).not.toContain("Authorization");
    expect(logs).not.toContain("Bearer");
    expect(logs).not.toContain("maria");
    const posted = fetchImpl.mock.calls.some((call) => {
      const headers = new Headers((call[1] as RequestInit | undefined)?.headers);
      return headers.get("authorization") === `Bearer ${accessToken}`;
    });
    expect(posted).toBe(true);
    expect(logs).not.toContain(accessToken);
  });

  it("401 sem cause vira mp_unauthorized e continua recusa definitiva", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reference = randomUUID();
    const mp = provider(mockFetch(() => new Response(JSON.stringify({
      message: leakedEmail,
      cause: [{ code: leakedToken, description: leakedEmail }],
    }), { status: 401, headers: { "x-request-id": "req-unauth-1" } })));
    await expect(mp.createPixCharge(chargeInput(reference), { businessId })).rejects.toMatchObject({ name: "PixCreateRefusedError", httpStatus: 401 });
    expect(warnLines(warn)).toContain(`mp_status=401 mp_cause=- mp_request_id=req-unauth-1 reason=mp_unauthorized`);
    expect(warnLines(warn)).not.toContain(leakedEmail);
    expect(warnLines(warn)).not.toContain("APP_USR");
  });

  it("5xx e erro de rede logam mp_unknown e não viram recusa definitiva", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reference = randomUUID();
    const down = provider(mockFetch(() => new Response(leakyBody, {
      status: 503,
      headers: { "x-request-id": `req-${leakedToken}` },
    })));
    await expect(down.createPixCharge(chargeInput(reference), { businessId })).rejects.toMatchObject({
      name: "MercadoPagoHttpError",
      status: 503,
      message: "Mercado Pago POST /v1/payments → 503",
    });
    expect(warnLines(warn)).toContain("mp_status=503 mp_cause=4037 mp_request_id=- reason=mp_invalid_amount");
    expect(warnLines(warn)).not.toContain("APP_USR");
    expect(warnLines(warn)).not.toContain(leakedEmail);

    warn.mockClear();
    const broken = provider(mockFetch(() => {
      throw new Error(`socket ${leakedToken} ${leakedEmail}`);
    }));
    await expect(broken.createPixCharge(chargeInput(), { businessId })).rejects.toThrow(/socket/);
    expect(warnLines(warn)).toContain("mp_status=- mp_cause=- mp_request_id=- reason=mp_unknown");
    expect(warnLines(warn)).not.toContain(leakedToken);
    expect(warnLines(warn)).not.toContain(leakedEmail);
    expect(warnLines(warn)).not.toContain("APP_USR");
  });
});
