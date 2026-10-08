import { json, readBody } from "@/lib/http";
import { readOnboardingDraftCookie } from "@/lib/onboarding/draft-cookie";
import { readOnboardingDraft, updateOnboardingDraft } from "@/lib/onboarding/drafts";
import { readRequestSession } from "@/lib/onboarding/request-session";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function reader(request: Request) {
  const session = await readRequestSession(request);
  return { cookieId: readOnboardingDraftCookie(request.headers.get("cookie")), sessionEmail: session?.email ?? null };
}

export function GET(request: Request, context: RouteContext<"/api/onboarding/drafts/[id]">) {
  return withAppCors(request, async () => json(await readOnboardingDraft((await context.params).id, await reader(request))));
}

export function PATCH(request: Request, context: RouteContext<"/api/onboarding/drafts/[id]">) {
  return withAppCors(request, async () => json(await updateOnboardingDraft((await context.params).id, JSON.parse(await readBody(request)), await reader(request))));
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET", "PATCH"]);
}
