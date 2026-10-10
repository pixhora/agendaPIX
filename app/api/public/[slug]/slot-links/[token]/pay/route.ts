import { withPublicSlug } from "@/lib/business-profile/public-route";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { paySlotLink } from "@/lib/bookings/slot-link";
import { redactSlotLinkError, withSlotLinkPrivacy } from "@/lib/bookings/slot-link-http";
import { json, parseJsonBody, readBody, withTiming } from "@/lib/http";
import { appPreflight } from "@/lib/origins";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/slot-links/[token]/pay">) {
  const started = performance.now();
  const { slug, token } = await context.params;
  const response = await withPublicSlug(request, slug, async () => {
    try {
      const body = parseJsonBody(await readBody(request));
      return withTiming(json(await paySlotLink(slug, token, body, bookingClientIdentity(request)), 201), started);
    } catch (error) {
      throw redactSlotLinkError(error, token);
    }
  });
  return withSlotLinkPrivacy(response);
}

export async function OPTIONS(request: Request) {
  return withSlotLinkPrivacy(await appPreflight(request, ["POST"]));
}
