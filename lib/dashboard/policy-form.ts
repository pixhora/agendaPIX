import {
  depositPolicyPresets,
  depositPolicySchema,
  PADRAO_DEPOSIT_POLICY,
  type DepositPolicy,
} from "../policy/schema";

export const PRESET_CHOICES = ["flexivel", "padrao", "rigida"] as const;
export type PresetChoice = (typeof PRESET_CHOICES)[number];

export type PolicyFormState = {
  chargeDeposit: boolean;
  policy: DepositPolicy;
};

type ServiceSeed = { depositCents?: number; depositPolicy?: DepositPolicy | null };

/** Serviço novo começa cobrando sinal, para o campo aparecer. Serviço salvo segue o valor gravado. */
export function initialPolicyForm(service?: ServiceSeed): PolicyFormState {
  const parsed = service?.depositPolicy ? depositPolicySchema.safeParse(service.depositPolicy) : null;
  return {
    chargeDeposit: service ? (service.depositCents ?? 0) > 0 : true,
    policy: parsed?.success ? parsed.data : { ...PADRAO_DEPOSIT_POLICY },
  };
}

export function selectPreset(state: PolicyFormState, preset: PresetChoice): PolicyFormState {
  return { ...state, policy: { ...depositPolicyPresets[preset] } };
}

export function patchPolicy(
  state: PolicyFormState,
  patch: Partial<Pick<DepositPolicy, "refundUntilHours" | "rescheduleUntilHours" | "lateCancel" | "noShow">>,
): { state: PolicyFormState; error: string | null } {
  const candidate = {
    version: 1 as const,
    preset: "personalizada" as const,
    refundUntilHours: patch.refundUntilHours === undefined ? state.policy.refundUntilHours : patch.refundUntilHours,
    rescheduleUntilHours: patch.rescheduleUntilHours === undefined ? state.policy.rescheduleUntilHours : patch.rescheduleUntilHours,
    maxReschedules: 1 as const,
    lateCancel: patch.lateCancel ?? state.policy.lateCancel,
    noShow: patch.noShow ?? state.policy.noShow,
    creditValidityDays: 60 as const,
  };
  const parsed = depositPolicySchema.safeParse(candidate);
  if (!parsed.success) return { state, error: parsed.error.issues[0]?.message ?? "Confira a política do sinal." };
  return { state: { ...state, policy: parsed.data }, error: null };
}

export function selectCustom(state: PolicyFormState) {
  return patchPolicy(state, {});
}

export function setChargeDeposit(state: PolicyFormState, chargeDeposit: boolean): PolicyFormState {
  return { ...state, chargeDeposit };
}

export function policiesMatch(left: DepositPolicy, right: DepositPolicy) {
  return (
    left.preset === right.preset
    && left.refundUntilHours === right.refundUntilHours
    && left.rescheduleUntilHours === right.rescheduleUntilHours
    && left.lateCancel === right.lateCancel
    && left.noShow === right.noShow
    && left.maxReschedules === right.maxReschedules
    && left.creditValidityDays === right.creditValidityDays
    && left.version === right.version
  );
}

export function isHarshPolicy(policy: DepositPolicy) {
  return policy.refundUntilHours === null && policy.rescheduleUntilHours === null && policy.lateCancel === "retain" && policy.noShow === "retain";
}

export function futureBookingsWarning(count: number) {
  if (!Number.isInteger(count) || count <= 0) return null;
  const lead = count === 1
    ? "1 reserva já feita continua com a regra que o cliente leu na hora da reserva."
    : `${count} reservas já feitas continuam com a regra que o cliente leu na hora da reserva.`;
  return `${lead} A nova regra vale só para as próximas.`;
}
