import { consumeDraftCreateLimit } from "@/lib/abuse-rate-limit";
import { json, readBody } from "@/lib/http";
import { onboardingDraftCookie } from "@/lib/onboarding/draft-cookie";
import { createOnboardingDraft } from "@/lib/onboarding/drafts";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

export function POST(request: Request) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    await consumeDraftCreateLimit(request);
    const created = await createOnboardingDraft(JSON.parse(await readBody(request)));
    const response = json(created, 201);
    response.headers.append("set-cookie", onboardingDraftCookie(created.draftId));
    return response;
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
