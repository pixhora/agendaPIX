import { HttpError, json } from "@/lib/http";
import { commitOnboardingDraft } from "@/lib/onboarding/drafts";
import { readRequestSession } from "@/lib/onboarding/request-session";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

export function POST(request: Request, context: RouteContext<"/api/onboarding/drafts/[id]/commit">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const session = await readRequestSession(request);
    if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    const { result, replay } = await commitOnboardingDraft((await context.params).id, session);
    return json(result, replay ? 200 : 201);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
