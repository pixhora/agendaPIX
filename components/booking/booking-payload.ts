import type { PublicService } from "./types";
import { servicePolicyState } from "./policy-gate";

export interface PublicBookingBodyInput {
  service: Pick<PublicService, "id" | "depositCents" | "policySummary" | "policyHash">;
  startsAt: string;
  name: string;
  phone: string;
  /** Dígitos do CPF. Ignorado quando o servidor manda `requiresPayerCpf: false`. */
  cpfDigits: string;
  /**
   * Ausente: o pedido ainda leva CPF, porque a API no master exige o documento.
   * `false`: o campo sai do corpo.
   */
  requiresPayerCpf?: boolean;
}

/** Corpo do `POST` público. Só inclui `policyHash` quando o servidor já mandou resumo e hash. */
export function buildPublicBookingBody(input: PublicBookingBodyInput) {
  const customer: { name: string; phone: string; cpfCnpj?: string } = {
    name: input.name,
    phone: input.phone,
  };
  if (input.requiresPayerCpf !== false && input.cpfDigits) {
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
