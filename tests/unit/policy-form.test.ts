import { describe, expect, it } from "vitest";
import { depositPolicyPresets, depositPolicySchema, PADRAO_DEPOSIT_POLICY, POLICY_HOUR_VALUES } from "../../lib/policy/schema";
import {
  futureBookingsWarning,
  initialPolicyForm,
  isHarshPolicy,
  patchPolicy,
  policiesMatch,
  selectCustom,
  selectPreset,
  setChargeDeposit,
} from "../../lib/dashboard/policy-form";

describe("estado do formulário da política", () => {
  it("serviço novo começa no Padrão cobrando sinal", () => {
    const state = initialPolicyForm();
    expect(state.chargeDeposit).toBe(true);
    expect(state.policy).toEqual(PADRAO_DEPOSIT_POLICY);
    expect(depositPolicySchema.safeParse(state.policy).success).toBe(true);
  });

  it("serviço sem sinal começa sem cobrança e mantém a política salva", () => {
    const state = initialPolicyForm({ depositCents: 0, depositPolicy: depositPolicyPresets.flexivel });
    expect(state.chargeDeposit).toBe(false);
    expect(state.policy.preset).toBe("flexivel");
  });

  it.each(["flexivel", "padrao", "rigida"] as const)("escolhe o modelo %s", (preset) => {
    const next = selectPreset(initialPolicyForm(), preset);
    expect(next.policy).toEqual(depositPolicyPresets[preset]);
    expect(policiesMatch(next.policy, depositPolicyPresets[preset])).toBe(true);
  });

  it("personalizar qualquer campo troca para personalizada e continua válida", () => {
    const start = selectPreset(initialPolicyForm(), "padrao");
    const refund = patchPolicy(start, { refundUntilHours: 48 });
    expect(refund.error).toBeNull();
    expect(refund.state.policy.preset).toBe("personalizada");
    expect(refund.state.policy.refundUntilHours).toBe(48);
    expect(refund.state.policy.rescheduleUntilHours).toBe(24);

    const reschedule = patchPolicy(refund.state, { rescheduleUntilHours: null });
    expect(reschedule.state.policy.rescheduleUntilHours).toBeNull();

    const late = patchPolicy(reschedule.state, { lateCancel: "credit" });
    expect(late.state.policy.lateCancel).toBe("credit");

    const missed = patchPolicy(late.state, { noShow: "refund" });
    expect(missed.state.policy.noShow).toBe("refund");
    expect(depositPolicySchema.safeParse(missed.state.policy).success).toBe(true);
    expect(policiesMatch(missed.state.policy, PADRAO_DEPOSIT_POLICY)).toBe(false);
  });

  it("rejeita hora fora da lista e não altera o estado", () => {
    const start = initialPolicyForm();
    const next = patchPolicy(start, { refundUntilHours: 3 as (typeof POLICY_HOUR_VALUES)[number] });
    expect(next.error).toBeTruthy();
    expect(next.state).toBe(start);
  });

  it("marcar personalizada preserva os prazos já escolhidos", () => {
    const start = selectPreset(initialPolicyForm(), "rigida");
    const custom = selectCustom(start);
    expect(custom.error).toBeNull();
    expect(custom.state.policy.preset).toBe("personalizada");
    expect(custom.state.policy.refundUntilHours).toBeNull();
    expect(isHarshPolicy(custom.state.policy)).toBe(true);
    expect(isHarshPolicy(depositPolicyPresets.flexivel)).toBe(false);
  });

  it("liga e desliga a cobrança sem mexer na política", () => {
    const start = selectPreset(initialPolicyForm(), "flexivel");
    const off = setChargeDeposit(start, false);
    expect(off.chargeDeposit).toBe(false);
    expect(off.policy).toEqual(start.policy);
  });

  it("aviso de reservas futuras usa o singular só para uma", () => {
    expect(futureBookingsWarning(0)).toBeNull();
    expect(futureBookingsWarning(1)).toMatch(/^1 reserva já feita/);
    expect(futureBookingsWarning(3)).toMatch(/^3 reservas já feitas/);
    expect(futureBookingsWarning(2)).toContain("A nova regra vale só para as próximas.");
  });
});
