import { withPublicSlug } from "@/lib/business-profile/public-route";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { createBooking } from "@/lib/bookings/service";
import { json, readBody } from "@/lib/http";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { appPreflight } from "@/lib/origins";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  const { slug } = await context.params;
  return withPublicSlug(request, slug, async () => {
    const result = await createBooking(slug, JSON.parse(await readBody(request)), request.headers.get("idempotency-key"), undefined, undefined, bookingClientIdentity(request));
    return json(serializePublicBooking(result.data), result.replayed ? 200 : 201);
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["POST"]); }
