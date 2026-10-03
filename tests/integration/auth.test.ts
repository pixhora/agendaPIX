import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { session, user, verification } from "../../db/schema";
import { getAuth } from "../../lib/auth";
import { sendMagicLinkEmail } from "../../lib/email";

vi.mock("../../lib/email", () => ({ sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined) }));

const email = `auth-${randomUUID()}@example.com`;

afterAll(async () => {
  const database = getDb();
  await database.delete(verification).where(like(verification.value, `%${email}%`));
  await database.delete(user).where(eq(user.email, email));
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
