import { handleHttp, json } from "@/lib/http";
import { processWebhook } from "@/lib/payments/webhook";

export async function POST(request: Request, context: RouteContext<"/api/webhooks/payments/[provider]">) {
  return handleHttp(async () => json(await processWebhook(request, (await context.params).provider)));
}
