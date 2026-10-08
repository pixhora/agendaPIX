import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";
import { getAuth } from "../../lib/auth";
import { sendMagicLinkEmail } from "../../lib/email";

vi.mock("../../lib/email", () => ({ sendMagicLinkEmail: vi.fn(), sendSignInCodeEmail: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://local:example@localhost/agenda");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
  vi.mocked(sendMagicLinkEmail).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function request(origin = "http://localhost:3000", email = "synthetic@example.com") {
  return new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, callbackURL: "/" }),
  });
}

it.each(["SMTP", "adapter", "APIError", "APIError503"])("esconde detalhes de falha %s no handler real, inclusive no console", async (source) => {
  const auth = getAuth();
  const context = await auth.$context;
  const persist = vi.spyOn(context.internalAdapter, "createVerificationValue").mockResolvedValue({} as never);
  const apiError = source.startsWith("APIError");
  const cookie = "synthetic_session=; Max-Age=0; HttpOnly; SameSite=Lax";
  const sensitive = apiError
    ? new APIError(source === "APIError503" ? "SERVICE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR", {
      code: "SYNTHETIC_PRIVATE_TOKEN", message: "SQL synthetic@example.com",
    }, { "set-cookie": cookie, "content-length": "999", "content-encoding": "gzip", etag: '"old-body"' })
    : new Error("SYNTHETIC_PRIVATE_TOKEN SQL synthetic@example.com");
  if (source !== "adapter") vi.mocked(sendMagicLinkEmail).mockRejectedValueOnce(sensitive);
  else persist.mockRejectedValueOnce(sensitive);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  const response = await auth.handler(request());
  expect(response.status).toBe(source === "APIError503" ? 503 : 500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("application/json");
  if (apiError) {
    expect(response.headers.get("set-cookie")).toBe(cookie);
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.has("content-encoding")).toBe(false);
    expect(response.headers.has("etag")).toBe(false);
  }
  expect(await response.text()).not.toContain(sensitive.message);
  const logged = [...error.mock.calls, ...warn.mock.calls].flat()
    .map((value) => value instanceof Error ? value.stack : String(value)).join(" ");
  expect(logged).not.toContain("SYNTHETIC_PRIVATE_TOKEN");
  expect(logged).not.toContain("synthetic@example.com");
  expect(error.mock.calls).toEqual([["[AgendaPix auth] Authentication operation failed"]]);
});

it("preserva envio bem-sucedido pelo handler sem acessar banco ou SMTP reais", async () => {
  const auth = getAuth();
  const context = await auth.$context;
  vi.spyOn(context.internalAdapter, "createVerificationValue").mockResolvedValue({} as never);
  expect((await auth.handler(request())).status).toBe(200);
  expect(sendMagicLinkEmail).toHaveBeenCalled();
});

it("aceita origem e callback absoluto da UI na autoridade local :3000", async () => {
  const auth = getAuth();
  const context = await auth.$context;
  vi.spyOn(context.internalAdapter, "createVerificationValue").mockResolvedValue({} as never);
  const origin = "http://localhost:3000";
  const response = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email: "synthetic@example.com", callbackURL: `${origin}/dashboard`, errorCallbackURL: `${origin}/login` }),
  }));
  expect(response.status).toBe(200);
  expect(sendMagicLinkEmail).toHaveBeenCalled();
});

it.each([3001, 3005, 3343])("rejeita origem legada da UI multi-app na porta %i", async (port) => {
  const auth = getAuth();
  const context = await auth.$context;
  const persist = vi.spyOn(context.internalAdapter, "createVerificationValue");
  vi.mocked(sendMagicLinkEmail).mockClear();
  const origin = `http://localhost:${port}`;
  expect((await auth.handler(request(origin))).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
  expect(sendMagicLinkEmail).not.toHaveBeenCalled();
});

it("preserva rejeição de origem sem criar verificação nem enviar email", async () => {
  const auth = getAuth();
  const context = await auth.$context;
  const persist = vi.spyOn(context.internalAdapter, "createVerificationValue");
  vi.mocked(sendMagicLinkEmail).mockClear();
  expect((await auth.handler(request("http://untrusted.example"))).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
  expect(sendMagicLinkEmail).not.toHaveBeenCalled();
});

it("preserva validação de email no handler", async () => {
  vi.mocked(sendMagicLinkEmail).mockClear();
  expect((await getAuth().handler(request("http://localhost:3000", "invalid"))).status).toBe(400);
  expect(sendMagicLinkEmail).not.toHaveBeenCalled();
});

it("responde indisponibilidade sem publicar configuração inválida", async () => {
  vi.resetModules();
  vi.stubEnv("BETTER_AUTH_SECRET", "invalid-synthetic-secret");
  const { getAuth: freshAuth } = await import("../../lib/auth");
  const { handleHttp } = await import("../../lib/http");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await handleHttp(async () => freshAuth().handler(request()));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: {
    code: "auth_unavailable", message: "O acesso está indisponível. Tente novamente mais tarde.",
  } });
  expect(error.mock.calls).toEqual([["[AgendaPix auth] Authentication operation failed"]]);
});
