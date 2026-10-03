import { getBookingPayment } from "@/lib/bookings/service";
import { handleHttp, json } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  return handleHttp(async () => {
    const { slug, id } = await context.params;
    return json(await getBookingPayment(slug, id, request.headers.get("authorization")));
  });
}
