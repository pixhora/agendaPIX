import { getAvailability } from "@/lib/bookings/service";
import { handleHttp, json } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  return handleHttp(async () => json(await getAvailability((await context.params).slug, Object.fromEntries(new URL(request.url).searchParams))));
}
