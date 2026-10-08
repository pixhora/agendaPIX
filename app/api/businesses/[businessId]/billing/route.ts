import { getAuth } from "@/lib/auth";
import { getBusinessBilling } from "@/lib/billing/status";
import { HttpError, json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/billing">) {
  return withAppCors(request, async () => json(await getBusinessBilling((await context.params).businessId, await requireOwner(request))));
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
