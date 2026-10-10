import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { resolveBlobStore } from "@/lib/business-profile/logo-store";
import { uploadServiceImage } from "@/lib/business-profile/service-image";
import { HttpError, json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/services/[serviceId]/image">) {
  return withAppCors(request, async () => {
    const ownerId = await requireOwner(request);
    const { businessId, serviceId } = await context.params;
    return json(await uploadServiceImage(businessId, serviceId, ownerId, request, getDb(), resolveBlobStore()));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
