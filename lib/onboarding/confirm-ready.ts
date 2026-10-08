import { INVALID_EMAIL_MESSAGE, isUsableEmail } from "@/lib/onboarding/email-hint";
import { OTP_LENGTH, otpDigits } from "@/lib/onboarding/otp";

export const CONFIRM_CODE_MESSAGE = "Digite o código de 6 dígitos.";

export type ConfirmReadyInput = {
  code: string;
  email: string;
  /** True when the screen has no usable address on file and must ask for one. */
  emailRequired: boolean;
  pending?: boolean;
};

/**
 * `POST /api/auth/sign-in/email-otp` needs `{ email, otp }`.
 * The confirm link carries the draft id and the code, not the address.
 */
export function confirmSubmitReady(input: ConfirmReadyInput): boolean {
  if (input.pending) return false;
  if (otpDigits(input.code).length < OTP_LENGTH) return false;
  if (input.emailRequired && !isUsableEmail(input.email)) return false;
  return true;
}

export function confirmIdleTarget(input: ConfirmReadyInput): { id: "confirm-email" | "otp-code"; message: string } | null {
  if (input.emailRequired && !isUsableEmail(input.email)) {
    return { id: "confirm-email", message: INVALID_EMAIL_MESSAGE };
  }
  if (otpDigits(input.code).length < OTP_LENGTH) {
    return { id: "otp-code", message: CONFIRM_CODE_MESSAGE };
  }
  return null;
}
