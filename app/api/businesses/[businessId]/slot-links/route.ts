import { getAuth } from "@/lib/auth";
import { createSlotLink, listSlotLinks } from "@/lib/bookings/slot-link";
import { HttpError, json, parseJsonBody, readBody } from "@/lib/http";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/slot-links">) {
  return withAppCors(request, async () => {
    const ownerId = await requireOwner(request);
    const { businessId } = await context.params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = url.searchParams.get("limit");
    return json(await listSlotLinks(businessId, ownerId, {
      date: url.searchParams.get("date"),
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit } : {}),
    }));
  });
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/slot-links">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const ownerId = await requireOwner(request);
    const { businessId } = await context.params;
    return json(await createSlotLink(businessId, ownerId, parseJsonBody(await readBody(request))), 201);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET", "POST"]);
}
