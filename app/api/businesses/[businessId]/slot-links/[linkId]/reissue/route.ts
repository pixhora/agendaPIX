import { getAuth } from "@/lib/auth";
import { reissueSlotLink } from "@/lib/bookings/slot-link";
import { HttpError, json } from "@/lib/http";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/slot-links/[linkId]/reissue">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const ownerId = await requireOwner(request);
    const { businessId, linkId } = await context.params;
    return json(await reissueSlotLink(businessId, ownerId, linkId), 201);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
