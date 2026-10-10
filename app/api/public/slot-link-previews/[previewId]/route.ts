import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { readSlotLinkPreview } from "@/lib/bookings/slot-link";
import { withSlotLinkPrivacy } from "@/lib/bookings/slot-link-http";
import { json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/public/slot-link-previews/[previewId]">) {
  const response = await withAppCors(request, async () => {
    const { previewId } = await context.params;
    return json(await readSlotLinkPreview(previewId, bookingClientIdentity(request)));
  });
  return withSlotLinkPrivacy(response);
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
