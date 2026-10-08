import { getAuth } from "@/lib/auth";
import { startSubscriptionCheckout, subscriptionCheckoutResponse } from "@/lib/billing/checkout";
import { HttpError } from "@/lib/http";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/subscription/checkout">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const ownerId = await requireOwner(request);
    const result = await startSubscriptionCheckout((await context.params).businessId, ownerId);
    return subscriptionCheckoutResponse(request, result);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}
