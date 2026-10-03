import { listPublicServices } from "@/lib/bookings/service";
import { handleHttp, json } from "@/lib/http";

export async function GET(_request: Request, context: RouteContext<"/api/public/[slug]/services">) {
  return handleHttp(async () => json(await listPublicServices((await context.params).slug)));
}
