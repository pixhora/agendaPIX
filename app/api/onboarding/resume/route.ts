import { HttpError, json } from "@/lib/http";
import { readRequestSession } from "@/lib/onboarding/request-session";
import { resumeTargetFromUrl } from "@/lib/onboarding/resume-contract";
import { resumeOwnedBusiness } from "@/lib/onboarding/resume";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O cadastro da sessão. A URL não escolhe o negócio. */
export function GET(request: Request) {
  return withAppCors(request, async () => {
    const session = await readRequestSession(request);
    if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    const resumed = await resumeOwnedBusiness(session.userId, undefined, resumeTargetFromUrl(request.url));
    if (!resumed) throw new HttpError(404, "onboarding_not_found", "Não encontramos este cadastro.");
    return json(resumed);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
