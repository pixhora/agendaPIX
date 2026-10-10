import { appPreflight, withAppCors } from "@/lib/origins";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { createBooking } from "@/lib/bookings/service";
import { json, readBody, withTiming } from "@/lib/http";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  const started = performance.now();
  return withAppCors(request, async () => {
    const result = await createBooking((await context.params).slug, JSON.parse(await readBody(request)), request.headers.get("idempotency-key"), undefined, undefined, bookingClientIdentity(request));
    return withTiming(json(serializePublicBooking(result.data), result.replayed ? 200 : 201), started);
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["POST"]); }
