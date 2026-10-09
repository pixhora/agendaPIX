import { depositFromPercent } from "@/lib/money";
import { retryAfterMinutes, type ApiErrorBody } from "@/lib/onboarding/api-error";
import { buildOnboardingDraftBody, type OnboardingDraftBody, type OnboardingDraftInput } from "@/lib/onboarding/draft";
import type { DraftWriteResult } from "@/lib/onboarding/drafts-client";
import { normalizeSlug } from "@/lib/slug";
import type { DepositMode, OnboardingData, OnboardingStep } from "@/components/onboarding/types";

export const TAKEN_LATER = "Alguém acabou de pegar esse link. Escolha outro, o resto do cadastro está guardado.";

const DEPOSIT_MODES = new Set<DepositMode>(["20", "30", "50", "custom", "none"]);
const STORED_STEPS = new Set<OnboardingStep>(["business", "service", "hours", "email", "code"]);

/** Em produção o cadastro começa no plano à venda. Fora dela, `completo` continua o padrão de desenvolvimento. */
export function onboardingPlanForEnv(plano: string | null | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): "base" | "completo" {
  if (nodeEnv === "production") return "base";
  return plano === "base" ? "base" : "completo";
}

export function createOnboardingData(plan: "base" | "completo"): OnboardingData {
  return {
    plan,
    businessName: "",
    slug: "",
    slugTouched: false,
    serviceName: "",
    durationMinutes: 45,
    priceCents: 0,
    depositCents: 0,
    depositMode: "30",
    openDays: [1, 2, 3, 4, 5, 6],
    opensAt: "09:00",
    closesAt: "19:00",
    email: "",
  };
}

export function inferSlugTouched(data: { businessName: string; slug: string }): boolean {
  if (!data.slug) return false;
  return data.slug !== normalizeSlug(data.businessName, { final: true });
}

export function inferDepositMode(data: { priceCents: number; depositCents: number; depositMode?: DepositMode }): DepositMode {
  if (data.depositMode && DEPOSIT_MODES.has(data.depositMode)) return data.depositMode;
  if (data.depositCents === 0) return data.priceCents > 0 ? "none" : "30";
  for (const percent of [20, 30, 50] as const) {
    if (depositFromPercent(data.priceCents, percent) === data.depositCents) return String(percent) as DepositMode;
  }
  return "custom";
}

export function restoreOnboardingDraft(raw: unknown, plan: "base" | "completo"): OnboardingData {
  const base = createOnboardingData(plan);
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Partial<OnboardingData>;
  const storedPlan = record.plan === "base" || record.plan === "completo" ? record.plan : plan;
  const next: OnboardingData = {
    ...base,
    plan: plan === "base" ? "base" : storedPlan,
    businessName: typeof record.businessName === "string" ? record.businessName : base.businessName,
    slug: typeof record.slug === "string" ? record.slug : base.slug,
    serviceName: typeof record.serviceName === "string" ? record.serviceName : base.serviceName,
    durationMinutes: typeof record.durationMinutes === "number" ? record.durationMinutes : base.durationMinutes,
    priceCents: typeof record.priceCents === "number" ? record.priceCents : base.priceCents,
    depositCents: typeof record.depositCents === "number" ? record.depositCents : base.depositCents,
    openDays: Array.isArray(record.openDays) ? record.openDays.filter((day): day is number => typeof day === "number") : base.openDays,
    opensAt: typeof record.opensAt === "string" ? record.opensAt : base.opensAt,
    closesAt: typeof record.closesAt === "string" ? record.closesAt : base.closesAt,
    email: typeof record.email === "string" ? record.email : base.email,
    segment: typeof record.segment === "string" ? record.segment : undefined,
  };
  next.slugTouched = typeof record.slugTouched === "boolean" ? record.slugTouched : inferSlugTouched(next);
  next.depositMode = typeof record.depositMode === "string" && DEPOSIT_MODES.has(record.depositMode as DepositMode)
    ? record.depositMode as DepositMode
    : inferDepositMode(next);
  if (next.depositMode === "none") next.depositCents = 0;
  return next;
}

/** Old numeric steps (1–4) map onto the four-step flow. Creating is never restored. */
export function stepFromStored(raw: string | null, hasDraftId: boolean): OnboardingStep {
  if (raw === "creating") return "email";
  if (raw === "code") return hasDraftId ? "code" : "email";
  if (raw && STORED_STEPS.has(raw as OnboardingStep)) return raw as OnboardingStep;
  const index = Number(raw);
  if (index === 2) return "service";
  if (index === 3) return "hours";
  if (index === 4) return "email";
  return "business";
}

export function stepperIndex(step: OnboardingStep): number {
  if (step === "business") return 1;
  if (step === "service") return 2;
  if (step === "hours") return 3;
  return 4;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  if (step === "service") return "business";
  if (step === "hours") return "service";
  if (step === "email") return "hours";
  if (step === "code") return "email";
  return null;
}

export function depositCentsForDraft(data: OnboardingData): number {
  const mode = data.depositMode ?? "30";
  if (mode === "none") return 0;
  if (mode === "custom") return data.depositCents;
  return depositFromPercent(data.priceCents, Number(mode));
}

export function draftInputFromOnboarding(data: OnboardingData): OnboardingDraftInput {
  return {
    email: data.email,
    plan: data.plan,
    segment: data.segment,
    businessName: data.businessName,
    slug: data.slug,
    serviceName: data.serviceName,
    durationMinutes: data.durationMinutes,
    priceCents: data.priceCents,
    depositCents: depositCentsForDraft(data),
    openDays: data.openDays,
    opensAt: data.opensAt,
    closesAt: data.closesAt,
  };
}

export function draftBodyFromOnboarding(data: OnboardingData): OnboardingDraftBody {
  return buildOnboardingDraftBody(draftInputFromOnboarding(data));
}

export function waitMinutesMessage(minutes: number | null): string {
  if (minutes == null) return "Muitas tentativas. Espere e tente de novo.";
  if (minutes === 1) return "Muitas tentativas. Espere 1 minuto e tente de novo.";
  return `Muitas tentativas. Espere ${minutes} minutos e tente de novo.`;
}

export type OtpSender = (email: string) => Promise<{ ok: true } | { ok: false; code: string; retryAfter?: number }>;

export type DraftSaveOutcome =
  | { type: "code_sent"; draftId: string }
  | { type: "slug_taken"; suggestions: string[]; draftId: string | null }
  | { type: "rate_limited"; minutes: number | null; draftId: string | null }
  | { type: "draft_failed" }
  | { type: "otp_failed"; draftId: string }
  | { type: "consumed" }
  | { type: "expired" }
  | { type: "not_found" }
  | { type: "offline"; draftId: string | null }
  | { type: "validation"; message: string; draftId: string | null }
  | { type: "generic"; draftId: string | null };

const PLAN_UNAVAILABLE_MESSAGE = "O plano completo ainda não está à venda. Comece pelo plano AgendaPix.";
const CHECK_INPUT_MESSAGE = "Confira os dados enviados.";

function fromDraftError(status: number, error: ApiErrorBody, draftId: string | null): DraftSaveOutcome {
  if (status === 0 || error.code === "network") return { type: "offline", draftId };
  if (error.code === "slug_unavailable") return { type: "slug_taken", suggestions: error.suggestions ?? [], draftId };
  if (error.code === "rate_limited" || error.code === "RATE_LIMITED") return { type: "rate_limited", minutes: retryAfterMinutes(error.retryAfter), draftId };
  if (error.code === "draft_consumed") return { type: "consumed" };
  if (error.code === "draft_expired" || status === 410) return { type: "expired" };
  if (error.code === "not_found" || status === 404) return { type: "not_found" };
  if (status >= 500 || error.code === "onboarding_unavailable") return { type: "draft_failed" };
  if (status === 400) {
    return {
      type: "validation",
      message: error.code === "plan_unavailable" ? PLAN_UNAVAILABLE_MESSAGE : CHECK_INPUT_MESSAGE,
      draftId,
    };
  }
  return { type: "generic", draftId };
}

/**
 * Creates or updates the server draft, then sends the code.
 * A failed draft never sends the e-mail.
 */
export async function saveDraftThenSendOtp(
  args: { draftId: string | null; body: OnboardingDraftBody; online: boolean },
  deps: {
    create: (body: OnboardingDraftBody) => Promise<DraftWriteResult>;
    patch: (id: string, patch: { email?: string; data?: OnboardingDraftBody["data"] }) => Promise<DraftWriteResult>;
    sendOtp: OtpSender;
  },
): Promise<DraftSaveOutcome> {
  if (!args.online) return { type: "offline", draftId: args.draftId };
  let draftId = args.draftId;
  if (!draftId) {
    const created = await deps.create(args.body);
    if (!created.ok) return fromDraftError(created.status, created.error, null);
    draftId = created.draftId;
  } else {
    const patched = await deps.patch(draftId, { email: args.body.email, data: args.body.data });
    if (!patched.ok) return fromDraftError(patched.status, patched.error, draftId);
  }
  const sent = await deps.sendOtp(args.body.email);
  if (!sent.ok) {
    if (sent.code === "rate_limited" || sent.code === "RATE_LIMITED") {
      return { type: "rate_limited", minutes: retryAfterMinutes(sent.retryAfter), draftId };
    }
    return { type: "otp_failed", draftId };
  }
  return { type: "code_sent", draftId };
}
