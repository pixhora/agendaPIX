import { betterAuth } from "better-auth";
import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { session, user, verification } from "../../db/schema";
import { getAuth } from "../../lib/auth";
import { sendMagicLinkEmail } from "../../lib/email";

vi.mock("../../lib/email", () => ({ sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined) }));

// Better Auth desliga validação de origem sob NODE_ENV=test; restaurar proteções.
function guardedAuth() {
  return betterAuth({ ...getAuth().options, advanced: { disableOriginCheck: false, disableCSRFCheck: false } });
}

let protectedAuth: ReturnType<typeof guardedAuth> | undefined;
function securityAuth() { return protectedAuth ??= guardedAuth(); }

const fixtureEmails: string[] = [];
const email = `auth-${randomUUID()}@example.com`;

fixtureEmails.push(email);

afterAll(async () => {
  const database = getDb();
  for (const fixtureEmail of fixtureEmails) {
    await database.delete(verification).where(like(verification.value, `%${fixtureEmail}%`));
    await database.delete(user).where(eq(user.email, fixtureEmail));
  }
  await database.$client.end();
});

it("link mágico cria sessão uma vez e não armazena token em texto", async () => {
  const auth = getAuth();
  const baseURL = process.env.BETTER_AUTH_URL!;
  const response = await auth.handler(new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(baseURL).origin },
    body: JSON.stringify({ email, name: "Dono de teste", callbackURL: "/" }),
  }));
  expect(response.status).toBe(200);
  expect(sendMagicLinkEmail).toHaveBeenCalledOnce();
  const [recipient, link] = vi.mocked(sendMagicLinkEmail).mock.calls[0];
  expect(recipient).toBe(email);
  const token = new URL(link).searchParams.get("token");
  expect(token).toBeTruthy();
  const pending = await getDb().select().from(verification).where(like(verification.value, `%${email}%`));
  expect(pending).toHaveLength(1);
  expect(JSON.stringify(pending)).not.toContain(token);

  const verified = await auth.handler(new Request(link));
  expect(verified.status).toBe(302);
  expect(verified.headers.get("set-cookie")).toContain("session_token=");
  const [registeredUser] = await getDb().select().from(user).where(eq(user.email, email));
  expect(registeredUser.emailVerified).toBe(true);
  const sessionsBefore = await getDb().select().from(session).where(eq(session.userId, registeredUser.id));
  expect(sessionsBefore).toHaveLength(1);

  const repeated = await auth.handler(new Request(link));
  expect(repeated.headers.get("set-cookie") ?? "").not.toContain("session_token=");
  expect(repeated.headers.get("location")).toContain("error=");
  const sessionsAfter = await getDb().select().from(session).where(eq(session.userId, registeredUser.id));
  expect(sessionsAfter).toHaveLength(1);

  const cookie = verified.headers.get("set-cookie")!.split(";")[0];
  const sessionURL = `${baseURL}/api/auth/get-session`;
  const authenticated = await auth.handler(new Request(sessionURL, { headers: { cookie } }));
  expect((await authenticated.json()).user.id).toBe(registeredUser.id);
  const anonymous = await auth.handler(new Request(sessionURL));
  expect(await anonymous.json()).toBeNull();
  await getDb().update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, registeredUser.id));
  const expired = await auth.handler(new Request(sessionURL, { headers: { cookie } }));
  expect(await expired.json()).toBeNull();
});

function newEmail() {
  const value = `auth-${randomUUID()}@example.com`;
  fixtureEmails.push(value);
  return value;
}

function requestLink(email: string, options: { origin?: string; callbackURL?: string } = {}, auth: Pick<ReturnType<typeof getAuth>, "handler"> = securityAuth()) {
  const baseURL = process.env.BETTER_AUTH_URL!;
  return auth.handler(new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: options.origin ?? new URL(baseURL).origin, cookie: "qa-origin=1" },
    body: JSON.stringify({ email, callbackURL: options.callbackURL ?? "/" }),
  }));
}

function capturedLink(email: string) {
  const call = vi.mocked(sendMagicLinkEmail).mock.calls.find(([recipient]) => recipient === email);
  expect(call).toBeDefined();
  return call![1];
}

it.each([
  { origin: "https://attacker.example" },
  { callbackURL: "https://attacker.example/callback" },
  { callbackURL: "//attacker.example/callback" },
])("rejeita origem/callback externo antes de enviar email: %j", async (options) => {
  const email = newEmail();
  const response = await requestLink(email, options);
  expect(response.status).toBe(403);
  expect(vi.mocked(sendMagicLinkEmail).mock.calls.some(([recipient]) => recipient === email)).toBe(false);
  expect(await getDb().select().from(verification).where(like(verification.value, `%${email}%`))).toHaveLength(0);
  expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
});

it("callback externo manipulado no link não cria sessão nem consome link válido", async () => {
  const email = newEmail();
  expect((await requestLink(email)).status).toBe(200);
  const link = capturedLink(email);
  const tampered = new URL(link);
  tampered.searchParams.set("callbackURL", "https://attacker.example/callback");
  const rejected = await securityAuth().handler(new Request(tampered));
  expect(rejected.status).toBe(403);
  expect(rejected.headers.get("set-cookie") ?? "").not.toContain("session_token=");
  expect((await getAuth().handler(new Request(link))).headers.get("set-cookie")).toContain("session_token=");
});

it("link expirado não cria usuário ou sessão", async () => {
  const email = newEmail();
  expect((await requestLink(email)).status).toBe(200);
  const [pending] = await getDb().select().from(verification).where(like(verification.value, `%${email}%`));
  expect(pending.expiresAt.getTime() - Date.now()).toBeGreaterThan(290_000);
  expect(pending.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(300_000);
  await getDb().update(verification).set({ expiresAt: new Date(Date.now() - 1000) })
    .where(like(verification.value, `%${email}%`));
  const response = await getAuth().handler(new Request(capturedLink(email)));
  expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
  expect(response.headers.get("location")).toContain("error=");
  expect(await getDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
});

it("consumo concorrente cria exatamente uma sessão", async () => {
  const email = newEmail();
  expect((await requestLink(email)).status).toBe(200);
  const link = capturedLink(email);
  const responses = await Promise.all(Array.from({ length: 8 }, () => getAuth().handler(new Request(link))));
  expect(responses.filter((response) => response.headers.get("set-cookie")?.includes("session_token="))).toHaveLength(1);
  const [owner] = await getDb().select().from(user).where(eq(user.email, email));
  expect(owner).toBeDefined();
  expect(await getDb().select().from(session).where(eq(session.userId, owner.id))).toHaveLength(1);
  for (const response of responses.filter((response) => !response.headers.get("set-cookie")?.includes("session_token="))) {
    expect(response.headers.get("location")).toContain("error=");
  }
});

it("limite habilitado bloqueia sexto pedido sem enviar sexto email", async () => {
  // Instância isolada: mesmas opções do produto, limite explicitamente ligado.
  // O padrão em desenvolvimento não oferece esta proteção.
  const auth = betterAuth({ ...getAuth().options, rateLimit: { enabled: true, storage: "memory" } });
  const email = newEmail();
  for (let index = 0; index < 5; index++) expect((await requestLink(email, {}, auth)).status).toBe(200);
  const rejected = await requestLink(email, {}, auth);
  expect(rejected.status).toBe(429);
  expect(Number(rejected.headers.get("x-retry-after"))).toBeGreaterThan(0);
  expect(vi.mocked(sendMagicLinkEmail).mock.calls.filter(([recipient]) => recipient === email)).toHaveLength(5);
});


it("origem inválida sem cookie também é rejeitada no primeiro login", async () => {
  const email = newEmail();
  const response = await securityAuth().handler(new Request(`${process.env.BETTER_AUTH_URL!}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" },
    body: JSON.stringify({ email, callbackURL: "/" }),
  }));
  expect(response.status).toBe(403);
  expect(vi.mocked(sendMagicLinkEmail).mock.calls.some(([recipient]) => recipient === email)).toBe(false);
});
