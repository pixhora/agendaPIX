import { withPublicSlug } from "@/lib/business-profile/public-route";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { openSlotLink } from "@/lib/bookings/slot-link";
import { redactSlotLinkError, withSlotLinkPrivacy } from "@/lib/bookings/slot-link-http";
import { json, withTiming } from "@/lib/http";
import { appPreflight } from "@/lib/origins";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/slot-links/[token]">) {
  const started = performance.now();
  const { slug, token } = await context.params;
  const response = await withPublicSlug(request, slug, async () => {
    try {
      return withTiming(json(await openSlotLink(slug, token, bookingClientIdentity(request))), started);
    } catch (error) {
      throw redactSlotLinkError(error, token);
    }
  });
  return withSlotLinkPrivacy(response);
}

export async function OPTIONS(request: Request) {
  return withSlotLinkPrivacy(await appPreflight(request, ["GET"]));
}
