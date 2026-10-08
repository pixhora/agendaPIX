import { readApiError, type ApiErrorBody } from "@/lib/onboarding/api-error";
import type { OnboardingDraftBody } from "@/lib/onboarding/draft";

export type DraftWriteResult =
  | { ok: true; draftId: string; expiresAt?: string }
  | { ok: false; status: number; error: ApiErrorBody };

export type CommitCallResult =
  | { ok: true; businessId: string; slug: string; publicPath: string; serviceId?: string }
  | { ok: false; status: number; error: ApiErrorBody };

export type DraftView = {
  draftId: string;
  email?: string;
  segment?: string;
  plan?: "base" | "completo";
  businessName?: string;
  expiresAt?: string;
};

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function network(error: unknown): ApiErrorBody {
  if (error instanceof DOMException && error.name === "AbortError") return { code: "aborted" };
  return { code: "network" };
}

export async function createOnboardingDraft(body: OnboardingDraftBody): Promise<DraftWriteResult> {
  try {
    const response = await send("/api/onboarding/drafts", "POST", body);
    if (response.status === 201) {
      const payload = await response.json().catch(() => null) as { draftId?: unknown; expiresAt?: unknown } | null;
      if (!payload || typeof payload.draftId !== "string") {
        return { ok: false, status: response.status, error: { code: "unknown" } };
      }
      return { ok: true, draftId: payload.draftId, expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined };
    }
    return { ok: false, status: response.status, error: await readApiError(response) };
  } catch (error) {
    return { ok: false, status: 0, error: network(error) };
  }
}

export async function patchOnboardingDraft(id: string, patch: { email?: string; data?: OnboardingDraftBody["data"] }): Promise<DraftWriteResult> {
  try {
    const response = await send(`/api/onboarding/drafts/${encodeURIComponent(id)}`, "PATCH", patch);
    if (response.ok) return { ok: true, draftId: id };
    return { ok: false, status: response.status, error: await readApiError(response) };
  } catch (error) {
    return { ok: false, status: 0, error: network(error) };
  }
}

export async function commitOnboardingDraft(id: string): Promise<CommitCallResult> {
  try {
    const response = await send(`/api/onboarding/drafts/${encodeURIComponent(id)}/commit`, "POST");
    if (response.ok) {
      const payload = await response.json().catch(() => null) as { businessId?: unknown; slug?: unknown; publicPath?: unknown; serviceId?: unknown } | null;
      if (!payload || typeof payload.slug !== "string") {
        return { ok: false, status: response.status, error: { code: "unknown" } };
      }
      const publicPath = typeof payload.publicPath === "string" ? payload.publicPath : `/${encodeURIComponent(payload.slug)}`;
      return {
        ok: true,
        businessId: typeof payload.businessId === "string" ? payload.businessId : "",
        slug: payload.slug,
        publicPath,
        serviceId: typeof payload.serviceId === "string" ? payload.serviceId : undefined,
      };
    }
    return { ok: false, status: response.status, error: await readApiError(response) };
  } catch (error) {
    return { ok: false, status: 0, error: network(error) };
  }
}

export async function getOnboardingDraft(id: string): Promise<{ ok: true; draft: DraftView } | { ok: false; status: number; error: ApiErrorBody }> {
  try {
    const response = await send(`/api/onboarding/drafts/${encodeURIComponent(id)}`, "GET");
    if (!response.ok) return { ok: false, status: response.status, error: await readApiError(response) };
    const payload = await response.json().catch(() => null) as {
      draftId?: unknown;
      email?: unknown;
      segment?: unknown;
      plan?: unknown;
      expiresAt?: unknown;
      data?: { business?: { name?: unknown } };
    } | null;
    const businessName = payload?.data?.business && typeof payload.data.business.name === "string" ? payload.data.business.name : undefined;
    return {
      ok: true,
      draft: {
        draftId: typeof payload?.draftId === "string" ? payload.draftId : id,
        email: typeof payload?.email === "string" ? payload.email : undefined,
        segment: typeof payload?.segment === "string" ? payload.segment : undefined,
        plan: payload?.plan === "base" || payload?.plan === "completo" ? payload.plan : undefined,
        businessName,
        expiresAt: typeof payload?.expiresAt === "string" ? payload.expiresAt : undefined,
      },
    };
  } catch (error) {
    return { ok: false, status: 0, error: network(error) };
  }
}
