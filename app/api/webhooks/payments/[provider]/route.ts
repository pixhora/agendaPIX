import { handleHttp, HttpError, json, MAX_BODY_BYTES, readBody } from "@/lib/http";
import { handleMpConnectWebhook } from "@/lib/mercadopago-oauth/connect-webhook";
import { processWebhook } from "@/lib/payments/webhook";

function isMpConnect(request: Request, body: string) {
  const params = new URL(request.url).searchParams;
  if ((params.get("type") ?? params.get("topic")) === "mp-connect") return true;
  try {
    const parsed = JSON.parse(body) as { type?: unknown };
    return parsed.type === "mp-connect";
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: RouteContext<"/api/webhooks/payments/[provider]">) {
  return handleHttp(async () => {
    const provider = (await context.params).provider;
    if (provider !== "mercadopago") return json(await processWebhook(request, provider));
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      throw new HttpError(413, "body_too_large", "Os dados enviados ultrapassam o limite permitido.");
    }
    const body = await readBody(request);
    if (isMpConnect(request, body)) return json(await handleMpConnectWebhook({ body, headers: request.headers, url: request.url }));
    return json(await processWebhook(new Request(request.url, { method: "POST", headers: request.headers, body }), provider));
  });
}
