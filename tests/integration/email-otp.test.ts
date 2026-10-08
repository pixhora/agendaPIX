import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { user, verification } from "../../db/schema";
import { getAuth } from "../../lib/auth";
import { sendSignInCodeEmail } from "../../lib/email";

vi.mock("../../lib/email", () => ({
  sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
  sendSignInCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

const db = getDb();
const emails: string[] = [];

function codeFor(email: string) {
  const call = vi.mocked(sendSignInCodeEmail).mock.calls.findLast((entry) => entry[0] === email);
  if (!call) throw new Error("código não enviado");
  return call[1];
}

async function sendCode(email: string, ip: string) {
  const baseURL = process.env.BETTER_AUTH_URL!;
  return getAuth().handler(new Request(`${baseURL}/api/auth/email-otp/send-verification-otp`, {
    method: "POST",
    headers: { origin: new URL(baseURL).origin, "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, type: "sign-in" }),
  }));
}

async function signIn(email: string, otp: string, ip: string) {
  const baseURL = process.env.BETTER_AUTH_URL!;
  return getAuth().handler(new Request(`${baseURL}/api/auth/sign-in/email-otp`, {
    method: "POST",
    headers: { origin: new URL(baseURL).origin, "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, otp }),
  }));
}

afterAll(async () => {
  for (const email of emails) {
    await db.delete(verification).where(eq(verification.identifier, `sign-in-otp-${email}`));
    await db.delete(user).where(eq(user.email, email));
  }
  await db.$client.end();
});

describe.sequential("código de acesso", () => {
  it("aceita o código aos 29 minutos e recusa aos 31", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fresh = `otp-fresh-${randomUUID()}@example.com`;
    const stale = `otp-stale-${randomUUID()}@example.com`;
    emails.push(fresh, stale);
    try {
      vi.setSystemTime(new Date("2026-10-08T12:00:00.000Z"));
      expect((await sendCode(fresh, "203.0.113.10")).status).toBe(200);
      const freshCode = codeFor(fresh);
      expect(freshCode).toMatch(/^\d{6}$/);
      const stored = await db.select().from(verification).where(like(verification.identifier, `sign-in-otp-${fresh}`));
      expect(JSON.stringify(stored)).not.toContain(freshCode);
      vi.setSystemTime(new Date("2026-10-08T12:29:00.000Z"));
      expect((await signIn(fresh, freshCode, "203.0.113.10")).status).toBe(200);

      vi.setSystemTime(new Date("2026-10-08T13:00:00.000Z"));
      expect((await sendCode(stale, "203.0.113.11")).status).toBe(200);
      vi.setSystemTime(new Date("2026-10-08T13:31:00.000Z"));
      const expired = await signIn(stale, codeFor(stale), "203.0.113.11");
      expect(expired.status).toBe(400);
      expect(JSON.stringify(await expired.json())).toContain("OTP_EXPIRED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bloqueia depois de 3 códigos errados e invalida o anterior no reenvio", async () => {
    const locked = `otp-lock-${randomUUID()}@example.com`;
    const rotated = `otp-rotate-${randomUUID()}@example.com`;
    emails.push(locked, rotated);
    expect((await sendCode(locked, "203.0.113.12")).status).toBe(200);
    const correct = codeFor(locked);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await signIn(locked, "000000", "203.0.113.12");
      expect(wrong.status).toBe(400);
    }
    expect((await signIn(locked, correct, "203.0.113.12")).status).toBe(403);

    expect((await sendCode(rotated, "203.0.113.13")).status).toBe(200);
    const first = codeFor(rotated);
    expect((await sendCode(rotated, "203.0.113.13")).status).toBe(200);
    const second = codeFor(rotated);
    expect(second).not.toBe(first);
    expect((await signIn(rotated, first, "203.0.113.13")).status).not.toBe(200);
    expect((await signIn(rotated, second, "203.0.113.13")).status).toBe(200);
  });

  it("limita 5 envios por e-mail a cada hora", async () => {
    const email = `otp-limit-${randomUUID()}@example.com`;
    emails.push(email);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await sendCode(email, "203.0.113.14")).status).toBe(200);
    }
    const limited = await sendCode(email, "203.0.113.14");
    expect(limited.status).toBe(429);
  });
});
