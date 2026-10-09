import { createHash } from "node:crypto";
import type { DepositPolicy } from "./schema";
import { ownerPreview, type OwnerPreviewContext } from "./text";

export function policyTextFor(policy: DepositPolicy, context: OwnerPreviewContext) {
  return ownerPreview(policy, context);
}

export function policyHashFor(policy: DepositPolicy, context: OwnerPreviewContext) {
  return createHash("sha256").update(policyTextFor(policy, context)).digest("hex");
}
