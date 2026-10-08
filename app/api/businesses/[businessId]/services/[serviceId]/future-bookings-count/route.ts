import { getAuth } from "@/lib/auth";
import { countFutureConfirmedBookings } from "@/lib/dashboard/data";
import { HttpError, json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/services/[serviceId]/future-bookings-count">) {
  return withAppCors(request, async () => {
    const { businessId, serviceId } = await context.params;
    return json(await countFutureConfirmedBookings(await requireOwner(request), businessId, serviceId));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
