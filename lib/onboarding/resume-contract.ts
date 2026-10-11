import { z } from "zod";

/** Recuperação do cadastro. Sem id e sem slug: a sessão do dono é a única chave. */
export const ONBOARDING_RESUME_PATH = "/api/onboarding/resume";

export const onboardingResumeSchema = z.object({
  businessId: z.uuid(),
  slug: z.string().min(1),
  publicPath: z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

export type OnboardingResume = z.infer<typeof onboardingResumeSchema>;
