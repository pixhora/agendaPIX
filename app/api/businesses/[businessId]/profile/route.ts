import { getAuth } from "@/lib/auth";
import { updateBusinessProfile } from "@/lib/business-profile/update";
import { HttpError, json, readBody } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function PATCH(request: Request, context: RouteContext<"/api/businesses/[businessId]/profile">) {
  return withAppCors(request, async () => {
    const ownerId = await requireOwner(request);
    const body = JSON.parse(await readBody(request));
    return json(await updateBusinessProfile((await context.params).businessId, ownerId, body));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["PATCH"]);
}
