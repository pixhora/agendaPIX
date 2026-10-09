import { handleHttp } from "@/lib/http";
import { requireBusinessOwner } from "@/lib/mercadopago-oauth/owner";
import { dismissLegacyPixKeyNotice } from "@/lib/pix-key/notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/notices/pix_key_retired/dismiss">) {
  return handleHttp(async () => {
    const { businessId } = await context.params;
    await requireBusinessOwner(request, businessId);
    await dismissLegacyPixKeyNotice(businessId);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}
