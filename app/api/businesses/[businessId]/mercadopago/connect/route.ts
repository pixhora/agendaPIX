import { NextResponse } from "next/server";
import { json } from "@/lib/http";
import { respondMercadoPagoConnect } from "@/lib/mercadopago/connect-navigation";
import { submitMercadoPagoConnect } from "@/lib/mercadopago-oauth/flow";
import { requireBusinessOwner } from "@/lib/mercadopago-oauth/owner";
import { MP_OAUTH_COOKIE, MP_OAUTH_COOKIE_MAX_AGE_SECONDS } from "@/lib/mercadopago-oauth/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookie = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MP_OAUTH_COOKIE_MAX_AGE_SECONDS,
};

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext<"/api/businesses/[businessId]/mercadopago/connect">) {
  return respondMercadoPagoConnect(request, async () => {
    const { businessId } = await context.params;
    const ownerId = await requireBusinessOwner(request, businessId);
    const result = await submitMercadoPagoConnect({ request, businessId, ownerId });
    if (result.kind === "json") return json(result.body, result.status);
    const response = NextResponse.redirect(result.location, 303);
    response.headers.set("cache-control", "no-store");
    if (result.cookie) response.cookies.set(MP_OAUTH_COOKIE, result.cookie, cookie);
    return response;
  });
}
