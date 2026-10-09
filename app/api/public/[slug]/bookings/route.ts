import { appPreflight, withAppCors } from "@/lib/origins";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { createBooking } from "@/lib/bookings/service";
import { json, readBody } from "@/lib/http";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  return withAppCors(request, async () => {
    const result = await createBooking((await context.params).slug, JSON.parse(await readBody(request)), request.headers.get("idempotency-key"), undefined, undefined, bookingClientIdentity(request));
    return json(serializePublicBooking(result.data), result.replayed ? 200 : 201);
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["POST"]); }
