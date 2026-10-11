import { z } from "zod";

/** Recuperação do cadastro. Sem id e sem slug: a sessão do dono é a única chave. */
export const ONBOARDING_RESUME_PATH = "/api/onboarding/resume";

/** Só estes três campos. CPF e token OAuth do Mercado Pago não cabem aqui. */
export const onboardingResumeSchema = z.object({
  businessId: z.uuid(),
  slug: z.string().min(1),
  publicPath: z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

export type OnboardingResume = z.infer<typeof onboardingResumeSchema>;

const resumeTargetSchema = z.object({
  businessId: z.uuid().optional(),
  slug: z.string().min(1).max(80).optional(),
}).strict();

export type ResumeTarget = { businessId?: string; slug?: string } | { reject: true };

/**
 * Id ou slug na URL só servem para recusar o cadastro de outro dono.
 * `code` e `state` do retorno OAuth não são lidos e não saem daqui.
 */
export function resumeTargetFromUrl(requestUrl: string): ResumeTarget {
  const url = new URL(requestUrl);
  const businessId = url.searchParams.get("businessId");
  const slug = url.searchParams.get("slug");
  if (!businessId && !slug) return {};
  const parsed = resumeTargetSchema.safeParse({
    ...(businessId ? { businessId } : {}),
    ...(slug ? { slug } : {}),
  });
  if (!parsed.success) return { reject: true };
  return parsed.data;
}
