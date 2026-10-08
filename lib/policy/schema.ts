import { z } from "zod";

export const POLICY_HOUR_VALUES = [2, 12, 24, 48] as const;
export const POLICY_PRESETS = ["flexivel", "padrao", "rigida", "personalizada"] as const;
export const LATE_CANCEL_OUTCOMES = ["retain", "credit"] as const;
export const NO_SHOW_OUTCOMES = ["retain", "credit", "refund"] as const;

const hoursSchema = z.union([z.literal(2), z.literal(12), z.literal(24), z.literal(48), z.null()]);

export const depositPolicySchema = z
  .object({
    version: z.literal(1),
    preset: z.enum(POLICY_PRESETS),
    refundUntilHours: hoursSchema,
    rescheduleUntilHours: hoursSchema,
    maxReschedules: z.literal(1),
    lateCancel: z.enum(LATE_CANCEL_OUTCOMES),
    noShow: z.enum(NO_SHOW_OUTCOMES),
    creditValidityDays: z.literal(60),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.lateCancel === "credit" || policy.noShow === "credit") return;
    if (policy.creditValidityDays !== 60) {
      context.addIssue({ code: "custom", message: "A validade do crédito é de 60 dias.", path: ["creditValidityDays"] });
    }
  });

export type DepositPolicy = z.infer<typeof depositPolicySchema>;

export const PADRAO_DEPOSIT_POLICY = {
  version: 1,
  preset: "padrao",
  refundUntilHours: 24,
  rescheduleUntilHours: 24,
  maxReschedules: 1,
  lateCancel: "retain",
  noShow: "retain",
  creditValidityDays: 60,
} as const satisfies DepositPolicy;

export const FLEXIVEL_DEPOSIT_POLICY = {
  version: 1,
  preset: "flexivel",
  refundUntilHours: 2,
  rescheduleUntilHours: 2,
  maxReschedules: 1,
  lateCancel: "credit",
  noShow: "credit",
  creditValidityDays: 60,
} as const satisfies DepositPolicy;

export const RIGIDA_DEPOSIT_POLICY = {
  version: 1,
  preset: "rigida",
  refundUntilHours: null,
  rescheduleUntilHours: null,
  maxReschedules: 1,
  lateCancel: "retain",
  noShow: "retain",
  creditValidityDays: 60,
} as const satisfies DepositPolicy;

export const depositPolicyPresets = {
  flexivel: FLEXIVEL_DEPOSIT_POLICY,
  padrao: PADRAO_DEPOSIT_POLICY,
  rigida: RIGIDA_DEPOSIT_POLICY,
} as const;

export const POLICY_CHANGED_CODE = "policy_changed" as const;
export const POLICY_CHANGED_MESSAGE = "A política do sinal mudou. Confira e confirme de novo.";

export const PADRAO_DEPOSIT_POLICY_JSON =
  '{"version":1,"preset":"padrao","refundUntilHours":24,"rescheduleUntilHours":24,"maxReschedules":1,"lateCancel":"retain","noShow":"retain","creditValidityDays":60}';
