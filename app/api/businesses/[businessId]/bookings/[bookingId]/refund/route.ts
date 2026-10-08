import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { HttpError, json, readBody } from "@/lib/http";
import { appPreflight, requireAppOrigin, withAppCors } from "@/lib/origins";
import { getPaymentProvider } from "@/lib/payments";
import { drizzleRefundPorts, executeOwnerRefund, previewOwnerRefund } from "@/lib/payments/refund-flow";

export const runtime = "nodejs";

const bodySchema = z.object({
  confirm: z.literal(true),
  expectedAmountCents: z.number().int().positive(),
}).strict();

async function requireOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  return session.user.id;
}

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/bookings/[bookingId]/refund">) {
  return withAppCors(request, async () => {
    const ownerId = await requireOwner(request);
    const { businessId, bookingId } = await context.params;
    return json(await previewOwnerRefund(drizzleRefundPorts(getDb()), businessId, bookingId, ownerId));
  });
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/bookings/[bookingId]/refund">) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
    const ownerId = await requireOwner(request);
    const { businessId, bookingId } = await context.params;
    const input = bodySchema.parse(JSON.parse(await readBody(request)));
    return json(await executeOwnerRefund(drizzleRefundPorts(getDb()), getPaymentProvider(), {
      businessId, bookingId, ownerId, expectedAmountCents: input.expectedAmountCents,
    }));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET", "POST"]);
}
