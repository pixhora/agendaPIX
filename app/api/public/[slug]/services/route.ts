import { appPreflight, withAppCors } from "@/lib/origins";
import { listPublicServices } from "@/lib/bookings/service";
import { json, withTiming } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/services">) {
  const started = performance.now();
  return withAppCors(request, async () => withTiming(json(await listPublicServices((await context.params).slug)), started));
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
