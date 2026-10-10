import { withPublicSlug } from "@/lib/business-profile/public-route";
import { getAvailability } from "@/lib/bookings/service";
import { json, withTiming } from "@/lib/http";
import { appPreflight } from "@/lib/origins";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const started = performance.now();
  const { slug } = await context.params;
  return withPublicSlug(request, slug, async () => withTiming(json(await getAvailability(slug, Object.fromEntries(new URL(request.url).searchParams))), started));
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
