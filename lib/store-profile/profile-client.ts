import { businessProfilePatchRequestSchema } from "@/lib/contracts";
import { readApiError } from "@/lib/onboarding/api-error";
import { profileErrorCopy } from "./api-copy";

export type ProfileSaveResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string; suggestions: string[]; fields: Record<string, string> };

function fieldMap(fields: unknown): Record<string, string> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) mapped[key] = value;
  }
  return mapped;
}

export async function patchBusinessProfile(
  businessId: string,
  body: { name?: string; slug?: string },
): Promise<ProfileSaveResult> {
  const parsed = businessProfilePatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, code: "invalid_input", message: profileErrorCopy("invalid_input"), suggestions: [], fields: {} };
  }
  try {
    const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/profile`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (response.ok) return { ok: true };
    const error = await readApiError(response);
    const code = response.status === 409 ? "slug_taken" : error.code;
    return {
      ok: false,
      status: response.status,
      code,
      message: profileErrorCopy(code),
      suggestions: error.suggestions ?? [],
      fields: fieldMap(error.fields),
    };
  } catch {
    return { ok: false, status: 0, code: "network", message: profileErrorCopy("internal_error"), suggestions: [], fields: {} };
  }
}
