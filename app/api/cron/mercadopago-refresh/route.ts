import { handleHttp, json } from "@/lib/http";
import { authorizeCron } from "@/lib/payments/cron";
import { purgeDisconnectedMercadoPagoTokens, refreshDueMercadoPagoConnections } from "@/lib/mercadopago-oauth/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  return handleHttp(async () => {
    authorizeCron(request.headers.get("authorization"));
    const refreshed = await refreshDueMercadoPagoConnections();
    const purged = await purgeDisconnectedMercadoPagoTokens();
    return json({ at: new Date().toISOString(), ...refreshed, ...purged });
  });
}

export const GET = handle;
export const POST = handle;
