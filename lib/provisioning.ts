import { z } from "zod";
import type { OnboardingData } from "@/components/onboarding/types";

export const provisioningPayloadSchema = z.object({
  businessName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
  slug: z.string().trim().min(2).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug deve ser kebab-case alfanumérico."),
  plan: z.enum(["base", "completo"]).default("base"),
  service: z.object({
    name: z.string().trim().min(2, "Nome do serviço deve ter pelo menos 2 caracteres."),
    durationMinutes: z.number().int().min(15).max(180),
    priceCents: z.number().int().min(0),
    depositCents: z.number().int().min(0),
  }).refine((s) => s.depositCents <= s.priceCents, {
    message: "O sinal no Pix não pode ser maior que o valor total.",
    path: ["depositCents"],
  }),
  hours: z.object({
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia de atendimento."),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de horário inválido (HH:mm)."),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de horário inválido (HH:mm)."),
  }).refine((h) => h.opensAt < h.closesAt, {
    message: "O horário de abertura deve ser anterior ao de fechamento.",
    path: ["closesAt"],
  }),
});

export type ProvisioningPayload = z.infer<typeof provisioningPayloadSchema>;

export type ProvisioningResult =
  | { ok: true; businessId: string; slug: string }
  | { ok: false; code: "not_implemented" | "unauthorized" | "conflict" | "invalid_payload" | "server_error"; message: string };

/**
 * Converte os dados do onboarding para o payload estrito de provisionamento.
 */
export function buildProvisioningPayload(data: OnboardingData): ProvisioningPayload {
  return provisioningPayloadSchema.parse({
    businessName: data.businessName,
    slug: data.slug,
    plan: data.plan,
    service: {
      name: data.serviceName,
      durationMinutes: data.durationMinutes,
      priceCents: data.priceCents,
      depositCents: data.depositCents,
    },
    hours: {
      openDays: data.openDays,
      opensAt: data.opensAt,
      closesAt: data.closesAt,
    },
  });
}

/**
 * Helper de provisionamento pós-autenticação preparado para o endpoint de T1 (F-01).
 * Não executa chamadas em produção antes da liberação do contrato de T1.
 */
export async function provisionBusiness(
  data: OnboardingData,
  endpoint = "/api/onboarding"
): Promise<ProvisioningResult> {
  let payload: ProvisioningPayload;
  try {
    payload = buildProvisioningPayload(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, code: "invalid_payload", message: err.issues[0]?.message || "Dados inválidos." };
    }
    return { ok: false, code: "invalid_payload", message: "Erro de validação dos dados." };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.status === 404 || res.status === 501) {
      return {
        ok: false,
        code: "not_implemented",
        message: "Endpoint de provisionamento ainda em preparação pelo backend.",
      };
    }

    if (res.status === 401) {
      return { ok: false, code: "unauthorized", message: "Sessão não autenticada." };
    }

    if (res.status === 409) {
      return { ok: false, code: "conflict", message: "Link personalizado já em uso." };
    }

    if (!res.ok) {
      return { ok: false, code: "server_error", message: "Erro ao criar negócio no servidor." };
    }

    const body = await res.json();
    return { ok: true, businessId: body.businessId, slug: body.slug };
  } catch {
    return { ok: false, code: "server_error", message: "Sem conexão com o servidor." };
  }
}
