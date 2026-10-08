import { normalizeSlug } from "@/lib/slug";

/** Same list as `ONBOARDING_SEGMENTS` in the draft schema. */
export const ONBOARDING_SEGMENTS = ["barbearia", "salao", "unhas", "cilios", "estetica", "tattoo", "personal", "saude", "outro"] as const;
export type OnboardingSegment = (typeof ONBOARDING_SEGMENTS)[number];

/**
 * The draft schema requires `segment`, and the segment step is not in this PR.
 * `outro` has no suggestion suffix, so it does not invent a niche.
 */
export const SEGMENT_UNTIL_STEP: OnboardingSegment = "outro";

const SEGMENT_SET = new Set<string>(ONBOARDING_SEGMENTS);

export function asOnboardingSegment(value: string | undefined): OnboardingSegment {
  return value && SEGMENT_SET.has(value) ? value as OnboardingSegment : SEGMENT_UNTIL_STEP;
}

export type OnboardingDraftInput = {
  email: string;
  plan: "base" | "completo";
  segment?: string;
  businessName: string;
  slug: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  openDays: number[];
  opensAt: string;
  closesAt: string;
};

export type OnboardingDraftBody = {
  email: string;
  plan: "base" | "completo";
  segment: OnboardingSegment;
  data: {
    business: { name: string; slug: string; timezone: "America/Sao_Paulo" };
    service: { name: string; durationMinutes: number; priceCents: number; depositCents: number };
    hours: { weekday: number; opensAt: string; closesAt: string }[];
  };
};

/** Body of POST /api/onboarding/drafts. One hours row per open day. No policy, WhatsApp or extra ranges. */
export function buildOnboardingDraftBody(input: OnboardingDraftInput): OnboardingDraftBody {
  const body: OnboardingDraftBody = {
    email: input.email.trim().toLowerCase(),
    plan: input.plan,
    segment: asOnboardingSegment(input.segment),
    data: {
      business: {
        name: input.businessName.trim(),
        slug: normalizeSlug(input.slug, { final: true }),
        timezone: "America/Sao_Paulo",
      },
      service: {
        name: input.serviceName.trim(),
        durationMinutes: input.durationMinutes,
        priceCents: input.priceCents,
        depositCents: input.depositCents,
      },
      hours: [...input.openDays]
        .sort((a, b) => a - b)
        .map((weekday) => ({ weekday, opensAt: input.opensAt, closesAt: input.closesAt })),
    },
  };
  return body;
}
