import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { HttpError, json } from "@/lib/http";
import { appPreflight, isAllowedAppOrigin, withAppCors } from "@/lib/origins";
import { acknowledgeDepositReversal } from "@/lib/payments/deposit-reversal-ack";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/bookings/[bookingId]/deposit-reversal/ack">) {
  return withAppCors(request, async () => {
    if (!isAllowedAppOrigin(request)) throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
    const ownerId = await requireOwner(request);
    const { businessId, bookingId } = await context.params;
    return json(await acknowledgeDepositReversal(getDb(), { ownerId, businessId, bookingId }));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
