import { policyHashFor } from "../../lib/policy/hash";
import { PADRAO_DEPOSIT_POLICY } from "../../lib/policy/schema";

export function padraoPolicyHash(businessName: string, depositCents = 1000) {
  void businessName;
  return policyHashFor(PADRAO_DEPOSIT_POLICY, { depositCents });
}
