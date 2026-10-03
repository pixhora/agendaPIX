import { createBooking } from "@/lib/bookings/service";
import { handleHttp, json, readBody } from "@/lib/http";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  return handleHttp(async () => {
    const result = await createBooking((await context.params).slug, JSON.parse(await readBody(request)), request.headers.get("idempotency-key"));
    return json(result.data, result.replayed ? 200 : 201);
  });
}
