import type { OnboardingData } from "./types";

/** Para onde o link mágico do cadastro leva: provisiona o negócio já com a sessão ativa. */
export const ONBOARDING_COMPLETE_PATH = "/onboarding/concluir";

export const COMPLETED_SETUP_KEY = "agenda_completed_onboarding_setup";
export const IDEMPOTENCY_KEY = "agenda_onboarding_idempotency_key";

export function ensureOnboardingIdempotencyKey(): string {
  try {
    const existing = localStorage.getItem(IDEMPOTENCY_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(IDEMPOTENCY_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function readCompletedSetup(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(COMPLETED_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as OnboardingData) : null;
  } catch {
    return null;
  }
}

export function clearCompletedSetup() {
  try {
    localStorage.removeItem(COMPLETED_SETUP_KEY);
    localStorage.removeItem(IDEMPOTENCY_KEY);
  } catch {
    // localStorage indisponível: nada a limpar.
  }
}
