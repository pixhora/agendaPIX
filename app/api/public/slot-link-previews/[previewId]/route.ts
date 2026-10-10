import { readSlotLinkPreview } from "@/lib/bookings/slot-link";
import { json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/public/slot-link-previews/[previewId]">) {
  return withAppCors(request, async () => {
    const { previewId } = await context.params;
    return json(await readSlotLinkPreview(previewId));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
