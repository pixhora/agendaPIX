import { z } from "zod";
import type { OnboardingData } from "@/components/onboarding/types";
import { onboardingInputSchema } from "@/lib/onboarding/validation";

/** Rota real de provisionamento neste mesmo app (`app/api/onboarding`). */
export const ONBOARDING_ENDPOINT = "/api/onboarding";

export type ProvisioningPayload = z.input<typeof onboardingInputSchema>;

export type ProvisioningResult =
  | { ok: true; businessId: string; slug: string; publicPath: string; serviceId?: string }
  | {
      ok: false;
      code: "unauthorized" | "conflict" | "idempotency_conflict" | "invalid_payload" | "server_error";
      message: string;
    };

/**
 * Converte os dados do formulário de onboarding para o contrato de `POST /api/onboarding`,
 * validando com o mesmo schema usado pela rota (fonte única de verdade).
 */
export function buildProvisioningPayload(data: OnboardingData): ProvisioningPayload {
  const payload: ProvisioningPayload = {
    business: {
      name: data.businessName,
      slug: data.slug,
      logoUrl: data.logoUrl,
      timezone: "America/Sao_Paulo",
      ...(data.contactWhatsapp ? { contactWhatsapp: data.contactWhatsapp } : {}),
    },
    service: {
      name: data.serviceName,
      durationMinutes: data.durationMinutes,
      priceCents: data.priceCents,
      depositCents: data.depositCents,
    },
    hours: [...data.openDays]
      .sort((a, b) => a - b)
      .map((weekday) => ({ weekday, opensAt: data.opensAt, closesAt: data.closesAt })),
  };
  onboardingInputSchema.parse(payload);
  return payload;
}

/**
 * Provisiona o negócio do usuário autenticado (sessão do Better Auth por cookie).
 * Preserva a mesma Idempotency-Key (UUID v4) e o mesmo corpo entre tentativas.
 */
export async function provisionBusiness(
  data: OnboardingData,
  options?: { idempotencyKey?: string },
): Promise<ProvisioningResult> {
  const idempotencyKey = options?.idempotencyKey || crypto.randomUUID();

  let payload: ProvisioningPayload;
  try {
    payload = buildProvisioningPayload(data);
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : undefined;
    return { ok: false, code: "invalid_payload", message: message || "Confira os dados do cadastro." };
  }

  try {
    const res = await fetch(ONBOARDING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      return { ok: false, code: "unauthorized", message: "Entre na sua conta para continuar." };
    }

    if (res.status === 409) {
      const body = await res.json().catch(() => null);
      // A rota responde { error: { code, message } } (lib/http.ts).
      if (body?.error?.code === "idempotency_conflict") {
        return { ok: false, code: "idempotency_conflict", message: "Essa tentativa já foi usada com outros dados." };
      }
      return { ok: false, code: "conflict", message: "Esse endereço já está em uso. Escolha outro." };
    }

    if (res.status === 400) {
      return { ok: false, code: "invalid_payload", message: "Confira os dados do cadastro." };
    }

    if (!res.ok) {
      return { ok: false, code: "server_error", message: "Não foi possível concluir o cadastro. Tente novamente." };
    }

    const body = await res.json();
    return {
      ok: true,
      businessId: body.businessId,
      slug: body.slug,
      publicPath: body.publicPath || `/${encodeURIComponent(body.slug)}`,
      serviceId: body.serviceId,
    };
  } catch {
    return { ok: false, code: "server_error", message: "Sem conexão com o servidor." };
  }
}
