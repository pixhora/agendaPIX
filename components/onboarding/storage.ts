import type { OnboardingData, OnboardingStep } from "./types";

/** Para onde o link mágico do cadastro leva: provisiona o negócio já com a sessão ativa. */
export const ONBOARDING_COMPLETE_PATH = "/onboarding/concluir";

export const COMPLETED_SETUP_KEY = "agenda_completed_onboarding_setup";
export const IDEMPOTENCY_KEY = "agenda_onboarding_idempotency_key";
export const DRAFT_KEY = "agenda_onboarding_draft";
export const STEP_KEY = "agenda_onboarding_step";
export const DRAFT_ID_KEY = "agenda_onboarding_draft_id";
const COMMIT_RESULT_KEY = "agenda_onboarding_commit";

export type CommitResult = { slug: string; publicPath: string };

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

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readOnboardingDraftRaw(): unknown {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(data: OnboardingData) {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // localStorage indisponível: o rascunho fica só na memória.
  }
}

export function readOnboardingStep(): string | null {
  try {
    return storage()?.getItem(STEP_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeOnboardingStep(step: OnboardingStep) {
  try {
    storage()?.setItem(STEP_KEY, step);
  } catch {
    // localStorage indisponível.
  }
}

export function readDraftId(): string | null {
  try {
    const value = storage()?.getItem(DRAFT_ID_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeDraftId(id: string) {
  try {
    storage()?.setItem(DRAFT_ID_KEY, id);
  } catch {
    // localStorage indisponível.
  }
}

/** Drops the local form, the step and the server draft id. Keeps a finished magic-link setup. */
export function clearOnboardingProgress() {
  try {
    const store = storage();
    store?.removeItem(DRAFT_KEY);
    store?.removeItem(STEP_KEY);
    store?.removeItem(DRAFT_ID_KEY);
  } catch {
    // localStorage indisponível.
  }
}

export function readCommitResult(): CommitResult | null {
  try {
    const raw = sessionStorage.getItem(COMMIT_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CommitResult>;
    if (typeof parsed.slug !== "string" || typeof parsed.publicPath !== "string") return null;
    if (!parsed.publicPath.startsWith("/")) return null;
    return { slug: parsed.slug, publicPath: parsed.publicPath };
  } catch {
    return null;
  }
}

export function writeCommitResult(result: CommitResult) {
  try {
    sessionStorage.setItem(COMMIT_RESULT_KEY, JSON.stringify(result));
  } catch {
    // sessionStorage indisponível: a conclusão ainda pode seguir pela navegação.
  }
}
