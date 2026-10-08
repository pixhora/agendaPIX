import { handleHttp, json } from "@/lib/http";
import { disconnectMercadoPago, getMercadoPagoOwnerStatus } from "@/lib/mercadopago-oauth/credentials";
import { requireBusinessOwner } from "@/lib/mercadopago-oauth/owner";
import { hasUndismissedLegacyPixKey } from "@/lib/pix-key/notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/mercadopago">) {
  return handleHttp(async () => {
    const { businessId } = await context.params;
    await requireBusinessOwner(request, businessId);
    const status = await getMercadoPagoOwnerStatus(businessId);
    return json({ ...status, hadLegacyPixKey: await hasUndismissedLegacyPixKey(businessId) });
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/businesses/[businessId]/mercadopago">) {
  return handleHttp(async () => {
    const { businessId } = await context.params;
    await requireBusinessOwner(request, businessId);
    await disconnectMercadoPago(businessId);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}
