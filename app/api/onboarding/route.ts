import { getAuth } from "@/lib/auth";
import { INVALID_ONBOARDING_IDEMPOTENCY_KEY_MESSAGE, rejectBlockedIdempotencyKey } from "@/lib/bookings/idempotency-key";
import { HttpError, json, readBody } from "@/lib/http";
import { provisionBusiness } from "@/lib/onboarding/service";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";
export function POST(request: Request) {
  return withAppCors(request, async () => {
    rejectBlockedIdempotencyKey(request.headers.get("idempotency-key") ?? "", INVALID_ONBOARDING_IDEMPOTENCY_KEY_MESSAGE);
    requireAppOrigin(request);
    const session = await getAuth().api.getSession({ headers: request.headers }).catch(() => {
      throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
    });
    if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
    const { result, replay } = await provisionBusiness(session.user.id, request.headers.get("idempotency-key"), JSON.parse(await readBody(request)));
    return json(result, replay ? 200 : 201);
  });
}
export function OPTIONS(request: Request) { return appPreflight(request, ["POST"]); }
