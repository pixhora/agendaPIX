import { getAuth } from "@/lib/auth";
import { authEnvSchema } from "@/lib/env";
import { handleHttp, HttpError, json, readBody } from "@/lib/http";
import { deleteBusinessPixKey, getBusinessPixKey, setBusinessPixKey } from "@/lib/pix-key/service";

export const runtime = "nodejs";

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new URL(authEnvSchema.parse(process.env).BETTER_AUTH_URL).origin;
  try {
    if (!origin || new URL(origin).origin !== allowed) throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
  }
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return handleHttp(async () => json(await getBusinessPixKey((await context.params).businessId, await requireOwner(request))));
}

export async function PUT(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return handleHttp(async () => {
    requireSameOrigin(request);
    const ownerId = await requireOwner(request);
    const input = JSON.parse(await readBody(request));
    return json(await setBusinessPixKey((await context.params).businessId, ownerId, input));
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/businesses/[businessId]/pix-key">) {
  return handleHttp(async () => {
    requireSameOrigin(request);
    return json(await deleteBusinessPixKey((await context.params).businessId, await requireOwner(request)));
  });
}
