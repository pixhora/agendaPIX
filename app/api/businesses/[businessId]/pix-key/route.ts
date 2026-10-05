import { getAuth } from "@/lib/auth";
import { HttpError, json, readBody } from "@/lib/http";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";
import { deleteBusinessPixKey, getBusinessPixKey, setBusinessPixKey } from "@/lib/pix-key/service";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return withAppCors(request, async () => json(await getBusinessPixKey((await context.params).businessId, await requireOwner(request))));
}

export async function PUT(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const ownerId = await requireOwner(request);
    const input = JSON.parse(await readBody(request));
    return json(await setBusinessPixKey((await context.params).businessId, ownerId, input));
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    return json(await deleteBusinessPixKey((await context.params).businessId, await requireOwner(request)));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET", "PUT", "DELETE"]);
}
