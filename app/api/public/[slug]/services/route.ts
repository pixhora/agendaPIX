import { appPreflight, withAppCors } from "@/lib/origins";
import { listPublicServices } from "@/lib/bookings/service";
import { json } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/services">) {
  return withAppCors(request, async () => json(await listPublicServices((await context.params).slug)));
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
