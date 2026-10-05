import { z } from "zod";
import { appPreflight, withAppCors } from "@/lib/origins";
import { handleHttp, json, readBody } from "@/lib/http";
import { simulateDevFakePayment, assertDevFakeSimulationAllowed } from "@/lib/payments/simulate-dev";

const bodySchema = z.object({
  slug: z.string().min(1).max(80),
  bookingId: z.uuid(),
}).strict();

export async function POST(request: Request) {
  return withAppCors(request, async () => {
    assertDevFakeSimulationAllowed();
    const parsed = bodySchema.parse(JSON.parse(await readBody(request)));
    const result = await simulateDevFakePayment({
      slug: parsed.slug,
      bookingId: parsed.bookingId,
      authorization: request.headers.get("authorization"),
    });
    return json(result);
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["POST"]);
}

export async function GET() {
  return handleHttp(async () => {
    assertDevFakeSimulationAllowed();
    return json({ error: { code: "method_not_allowed", message: "Use POST." } }, 405);
  });
}
