import type { PublicService } from "./types";
import { servicePolicyState } from "./policy-gate";

export interface PublicBookingBodyInput {
  service: Pick<PublicService, "id" | "depositCents" | "policySummary" | "policyHash">;
  startsAt: string;
  name: string;
  phone: string;
  /** Dígitos do CPF. Só entram no corpo quando `requiresPayerCpf` é `true`. */
  cpfDigits: string;
  /** `true`: envia o CPF. Qualquer outro valor tira o campo do corpo. */
  requiresPayerCpf?: boolean;
}

/** Corpo do `POST` público. Só inclui `policyHash` quando o servidor já mandou resumo e hash. */
export function buildPublicBookingBody(input: PublicBookingBodyInput) {
  const customer: { name: string; phone: string; cpfCnpj?: string } = {
    name: input.name,
    phone: input.phone,
  };
  if (input.requiresPayerCpf === true && input.cpfDigits) {
    customer.cpfCnpj = input.cpfDigits;
  }
  const policy = servicePolicyState(input.service);
  return {
    serviceId: input.service.id,
    startsAt: input.startsAt,
    customer,
    ...(policy === "ready" && input.service.policyHash ? { policyHash: input.service.policyHash } : {}),
  };
}

/** Tira CPF gravado por uma versão antiga da sessão. */
export function stripStoredBookingCpf(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { record: null, hadCpf: false };
  const record = { ...(value as Record<string, unknown>) };
  const hadCpf = "customerCpf" in record;
  delete record.customerCpf;
  return { record, hadCpf };
}
