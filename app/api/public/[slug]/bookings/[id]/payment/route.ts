import { getDb } from "@/db";
import { withPublicSlug } from "@/lib/business-profile/public-route";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { getBookingPayment } from "@/lib/bookings/service";
import { json } from "@/lib/http";
import { appPreflight } from "@/lib/origins";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  const { slug, id } = await context.params;
  return withPublicSlug(request, slug, async () => {
    const view = await getBookingPayment(slug, id, request.headers.get("authorization"), getDb(), bookingClientIdentity(request));
    return json(serializePublicBooking(view));
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
