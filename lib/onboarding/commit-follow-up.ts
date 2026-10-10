import type { ApiErrorBody } from "@/lib/onboarding/api-error";

export type CommitFollowUp =
  | { type: "done"; slug: string; publicPath: string }
  | { type: "slug_taken"; suggestions: string[] }
  | { type: "has_business"; publicPath?: string }
  | { type: "unauthorized" }
  | { type: "expired" }
  | { type: "consumed" }
  | { type: "wrong_email" }
  | { type: "retry" }
  | { type: "offline" }
  | { type: "generic" };

/**
 * Maps the commit response by `error.code`.
 * `already_has_business` is behind a backend flag that is off by default:
 * the branch exists, and the rest of the flow does not require it.
 */
export function followUpFromFailure(status: number, error: ApiErrorBody): CommitFollowUp {
  if (status === 0 || error.code === "network") return { type: "offline" };
  if (error.code === "already_has_business") return { type: "has_business", publicPath: error.publicPath };
  if (error.code === "draft_consumed") return { type: "consumed" };
  if (error.code === "slug_unavailable" || error.code === "slug_taken") return { type: "slug_taken", suggestions: error.suggestions ?? [] };
  if (error.code === "unauthorized" || (error.code === "unknown" && status === 401)) return { type: "unauthorized" };
  if (error.code === "not_found" || (error.code === "unknown" && status === 404)) return { type: "wrong_email" };
  if (error.code === "draft_expired" || (error.code === "unknown" && status === 410)) return { type: "expired" };
  if (error.code === "onboarding_unavailable" || status === 503 || status >= 500) return { type: "retry" };
  return { type: "generic" };
}
