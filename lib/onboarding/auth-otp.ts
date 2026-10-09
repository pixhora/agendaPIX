"use client";

export type AuthCallResult = { ok: true } | { ok: false; code: string; retryAfter?: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

/**
 * Better Auth puts `code` on the JSON root. The quota path uses `RATE_LIMITED`.
 * The plugin limiter may answer 429 with only a message and `X-Retry-After`.
 */
export function readOtpFailure(body: unknown, status: number, retryAfterHeader: string | null): { code: string; retryAfter?: number } {
  const top = asRecord(body);
  const header = Number(retryAfterHeader ?? top?.retryAfter);
  const retryAfter = Number.isFinite(header) && header > 0 ? header : undefined;
  const topCode = typeof top?.code === "string" ? top.code : "";
  if (topCode === "RATE_LIMITED" || status === 429) return { code: "RATE_LIMITED", retryAfter };
  if (topCode) return { code: topCode, retryAfter };
  const nested = asRecord(top?.error);
  if (typeof nested?.code === "string" && nested.code.length > 0) return { code: nested.code, retryAfter };
  return { code: "unknown", retryAfter };
}

async function postOtp(path: string, body: unknown): Promise<AuthCallResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const payload = await response.json().catch(() => null);
    const failure = readOtpFailure(payload, response.status, response.headers.get("X-Retry-After") ?? response.headers.get("Retry-After"));
    return { ok: false, ...failure };
  } catch {
    return { ok: false, code: "network" };
  }
}

export function sendSignInOtp(email: string): Promise<AuthCallResult> {
  return postOtp("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
}

export function signInWithEmailOtp(email: string, otp: string, name?: string): Promise<AuthCallResult> {
  const trimmed = name?.trim();
  return postOtp("/api/auth/sign-in/email-otp", {
    email,
    otp,
    ...(trimmed ? { name: trimmed } : {}),
  });
}
