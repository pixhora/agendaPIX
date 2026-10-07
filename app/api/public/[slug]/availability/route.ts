import { appPreflight, withAppCors } from "@/lib/origins";
import { getAvailability } from "@/lib/bookings/service";
import { json } from "@/lib/http";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  return withAppCors(request, async () => json(await getAvailability((await context.params).slug, Object.fromEntries(new URL(request.url).searchParams), bookingClientIdentity(request))));
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
