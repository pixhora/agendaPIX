export const OTP_LENGTH = 6;
export const OTP_ATTEMPTS = 3;
export const RESEND_WAIT_SECONDS = 30;

export function otpDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function formatResendWait(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export type OtpFailure =
  | { kind: "invalid"; remaining: number }
  | { kind: "locked" }
  | { kind: "expired" }
  | { kind: "rate_limited"; minutes: number | null }
  | { kind: "unknown" };

/**
 * Better Auth emailOTP 1.7.7 codes: INVALID_OTP, OTP_EXPIRED, TOO_MANY_ATTEMPTS.
 * The server allows 3 wrong checks; the third wrong code locks the next try,
 * so the UI locks as soon as no attempts remain.
 */
export function mapOtpError(code: string | undefined, attemptsUsed: number): OtpFailure {
  if (code === "OTP_EXPIRED") return { kind: "expired" };
  if (code === "TOO_MANY_ATTEMPTS") return { kind: "locked" };
  if (code === "rate_limited" || code === "RATE_LIMITED") return { kind: "rate_limited", minutes: null };
  if (code === "INVALID_OTP") {
    const remaining = OTP_ATTEMPTS - (attemptsUsed + 1);
    if (remaining <= 0) return { kind: "locked" };
    return { kind: "invalid", remaining };
  }
  return { kind: "unknown" };
}

export function wrongCodeMessage(remaining: number): string {
  const noun = remaining === 1 ? "tentativa" : "tentativas";
  return `Código incorreto. Você tem mais ${remaining} ${noun}.`;
}
