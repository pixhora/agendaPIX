import type { OnboardingData, OnboardingStep } from "@/components/onboarding/types";
import { formatCents } from "@/lib/money";
import { createOnboardingData, restoreOnboardingDraft, stepFromStored } from "@/lib/onboarding/flow";

/** Same 7 days as the server draft in `lib/onboarding/drafts.ts`. */
export const LOCAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type LocalDraftEnvelope = {
  v: 1;
  savedAt: string;
  boundEmail: string | null;
  data: OnboardingData;
};

export type LocalDraftDecision =
  | { action: "start" }
  | { action: "discard"; reason: "expired" | "other_account" }
  | { action: "prompt"; data: OnboardingData; step: OnboardingStep; draftId: string | null };

export function normalizeAccountEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function localDraftEnvelope(data: OnboardingData, boundEmail: string | null, savedAt: string): LocalDraftEnvelope {
  return { v: 1, savedAt, boundEmail: normalizeAccountEmail(boundEmail), data };
}

export function draftBoundEmail(formEmail: string, sessionEmail: string | null): string | null {
  return normalizeAccountEmail(formEmail) ?? normalizeAccountEmail(sessionEmail);
}

/** Unwraps the versioned envelope. Older saves are the form object itself. */
export function storedDraftPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Partial<LocalDraftEnvelope>;
  if (record.v === 1 && record.data && typeof record.data === "object") return record.data;
  return raw;
}

function draftHasUserContent(data: OnboardingData): boolean {
  return data.businessName.trim().length > 0
    || data.slug.trim().length > 0
    || data.serviceName.trim().length > 0
    || data.priceCents > 0
    || data.depositCents > 0
    || data.email.trim().length > 0;
}

function emailsConflict(sessionEmail: string | null, ...candidates: Array<string | null | undefined>): boolean {
  const session = normalizeAccountEmail(sessionEmail);
  if (!session) return false;
  return candidates.some((value) => {
    const email = normalizeAccountEmail(value);
    return email !== null && email !== session;
  });
}

/**
 * A device draft never becomes the live form by itself.
 * Another account is dropped. A dated draft older than the TTL is dropped.
 * Anything else with real content waits for "Continuar rascunho".
 */
export function decideLocalDraftRestore(input: {
  raw: unknown;
  step: string | null;
  draftId: string | null;
  now: number;
  sessionEmail: string | null;
  plan: "base" | "completo";
}): LocalDraftDecision {
  const data = restoreOnboardingDraft(storedDraftPayload(input.raw), input.plan);
  if (!draftHasUserContent(data)) return { action: "start" };

  const record = input.raw && typeof input.raw === "object" ? input.raw as Partial<LocalDraftEnvelope> : null;
  const savedAt = record?.v === 1 && typeof record.savedAt === "string" ? Date.parse(record.savedAt) : null;
  if (savedAt != null) {
    const age = input.now - savedAt;
    if (!Number.isFinite(age) || age < -60_000 || age > LOCAL_DRAFT_TTL_MS) {
      return { action: "discard", reason: "expired" };
    }
  }

  const boundEmail = record?.v === 1 ? record.boundEmail : null;
  if (emailsConflict(input.sessionEmail, boundEmail, data.email)) {
    return { action: "discard", reason: "other_account" };
  }

  return {
    action: "prompt",
    data,
    step: stepFromStored(input.step, Boolean(input.draftId)),
    draftId: input.draftId,
  };
}

/** What the page preview shows. A pending choice keeps the empty form. */
export function liveOnboardingData(decision: LocalDraftDecision, accepted: boolean, plan: "base" | "completo"): OnboardingData {
  if (accepted && decision.action === "prompt") return decision.data;
  return createOnboardingData(plan);
}

export function draftResumeLines(data: OnboardingData): { title: string; detail: string } {
  const title = data.businessName.trim() || "Negócio sem nome";
  const service = data.serviceName.trim() || "Serviço sem nome";
  const price = data.priceCents > 0 ? `R$ ${formatCents(data.priceCents)}` : "preço em branco";
  const deposit = data.depositCents > 0 ? `sinal R$ ${formatCents(data.depositCents)}` : "sem sinal";
  return { title, detail: `${service} · ${price} · ${deposit}` };
}

/** Logout, or a switch to an account that is not the one this form is using. */
export function shouldClearDraftOnSessionChange(previousEmail: string | null, nextEmail: string | null, formEmail: string | null): boolean {
  const previous = normalizeAccountEmail(previousEmail);
  const next = normalizeAccountEmail(nextEmail);
  if (!previous || previous === next) return false;
  if (!next) return true;
  const form = normalizeAccountEmail(formEmail);
  return form !== next;
}
