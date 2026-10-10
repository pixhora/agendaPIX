import { readApiError } from "@/lib/onboarding/api-error";
import { businessProfileSchema } from "@/lib/dashboard/validation";

export type ProfileSaveResult =
  | { ok: true }
  | { ok: false; status: number; code: string; suggestions: string[] };

export async function patchBusinessProfile(
  businessId: string,
  body: { name: string; slug: string; logoUrl: string | null },
): Promise<ProfileSaveResult> {
  const parsed = businessProfileSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid_input", suggestions: [] };
  try {
    const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/profile`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (response.ok) return { ok: true };
    const error = await readApiError(response);
    const taken = response.status === 409 && (error.code === "slug_taken" || error.code === "slug_unavailable");
    return { ok: false, status: response.status, code: taken ? "slug_taken" : error.code, suggestions: error.suggestions ?? [] };
  } catch {
    return { ok: false, status: 0, code: "network", suggestions: [] };
  }
}
