import { handleHttp, json } from "@/lib/http";
import { acceptMercadoPagoConsent } from "@/lib/mercadopago-oauth/flow";
import { requireBusinessOwner } from "@/lib/mercadopago-oauth/owner";
import { hasUndismissedLegacyPixKey } from "@/lib/pix-key/notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/mercadopago/consent">) {
  return handleHttp(async () => {
    const { businessId } = await context.params;
    const ownerId = await requireBusinessOwner(request, businessId);
    const result = await acceptMercadoPagoConsent({ request, businessId, ownerId });
    if (result.kind === "error") return json(result.body, result.status);
    return json({ ...result.status, hadLegacyPixKey: await hasUndismissedLegacyPixKey(businessId) });
  });
}
