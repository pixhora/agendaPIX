import { getAuth } from "@/lib/auth";
import { resolveBlobStore, uploadBusinessLogo } from "@/lib/business-profile/logo-store";
import { HttpError, json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/logo">) {
  return withAppCors(request, async () => {
    const ownerId = await requireOwner(request);
    const store = resolveBlobStore();
    return json(await uploadBusinessLogo((await context.params).businessId, ownerId, request, undefined, store));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
