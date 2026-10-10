import { appPreflight, withAppCors } from "@/lib/origins";
import { getAvailability } from "@/lib/bookings/service";
import { json, withTiming } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const started = performance.now();
  return withAppCors(request, async () => withTiming(json(await getAvailability((await context.params).slug, Object.fromEntries(new URL(request.url).searchParams))), started));
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
