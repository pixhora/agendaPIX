import { z } from "zod";
import type { OnboardingData } from "@/components/onboarding/types";

export const backendProvisioningPayloadSchema = z.object({
  business: z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    timezone: z.string().default("America/Sao_Paulo"),
  }),
  service: z.object({
    name: z.string().trim().min(1).max(120),
    durationMinutes: z.number().int().positive(),
    priceCents: z.number().int().min(0),
    depositCents: z.number().int().min(0),
  }).refine((s) => s.depositCents <= s.priceCents, {
    message: "O sinal no Pix não pode ser maior que o valor total.",
    path: ["depositCents"],
  }),
  hours: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }).refine((h) => h.opensAt < h.closesAt, {
    message: "O horário de abertura deve ser anterior ao de fechamento.",
  })).min(1).max(7),
});

export type BackendProvisioningPayload = z.infer<typeof backendProvisioningPayloadSchema>;

export type ProvisioningResult =
  | { ok: true; businessId: string; slug: string; publicPath: string; serviceId?: string }
  | {
      ok: false;
      code: "unauthorized" | "conflict" | "idempotency_conflict" | "invalid_payload" | "server_error";
      message: string;
    };

/**
 * Converte os dados do formulário de onboarding para o contrato exato do backend F-01.
 */
export function buildProvisioningPayload(data: OnboardingData): BackendProvisioningPayload {
  const hours = data.openDays.map((weekday) => ({
    weekday,
    opensAt: data.opensAt,
    closesAt: data.closesAt,
  })).sort((a, b) => a.weekday - b.weekday);

  return backendProvisioningPayloadSchema.parse({
    business: {
      name: data.businessName,
      slug: data.slug,
      timezone: "America/Sao_Paulo",
    },
    service: {
      name: data.serviceName,
      durationMinutes: data.durationMinutes,
      priceCents: data.priceCents,
      depositCents: data.depositCents,
    },
    hours,
  });
}

/** URL padrão da autoridade backend */
export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

/**
 * Helper de provisionamento pós-autenticação consumindo a autoridade backend :3000 (F-01).
 * Preserva Idempotency-Key UUIDv4 e o mesmo corpo entre tentativas (retries).
 */
export async function provisionBusiness(
  data: OnboardingData,
  options?: {
    endpoint?: string;
    idempotencyKey?: string;
  }
): Promise<ProvisioningResult> {
  const endpoint = options?.endpoint || `${BACKEND_BASE_URL}/api/onboarding`;
  const idempotencyKey = options?.idempotencyKey || crypto.randomUUID();

  let payload: BackendProvisioningPayload;
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
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      return { ok: false, code: "unauthorized", message: "Entre na sua conta para continuar." };
    }

    if (res.status === 409) {
      const errBody = await res.json().catch(() => null);
      if (errBody?.code === "idempotency_conflict") {
        return {
          ok: false,
          code: "idempotency_conflict",
          message: "Essa tentativa já foi usada com outros dados.",
        };
      }
      return { ok: false, code: "conflict", message: "Esse endereço já está em uso. Escolha outro." };
    }

    if (!res.ok) {
      return { ok: false, code: "server_error", message: "Não foi possível concluir o cadastro. Tente novamente." };
    }

    const body = await res.json();
    return {
      ok: true,
      businessId: body.businessId,
      slug: body.slug,
      publicPath: body.publicPath || `/${body.slug}`,
      serviceId: body.serviceId,
    };
  } catch {
    return { ok: false, code: "server_error", message: "Sem conexão com o servidor." };
  }
}
