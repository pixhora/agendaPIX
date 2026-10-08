import { NextResponse } from "next/server";
import { handleHttp } from "@/lib/http";
import { beginMercadoPagoConnect } from "@/lib/mercadopago-oauth/flow";
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

export async function GET(request: Request, context: RouteContext<"/api/businesses/[businessId]/mercadopago/connect">) {
  return handleHttp(async () => {
    const { businessId } = await context.params;
    await requireBusinessOwner(request, businessId);
    const started = beginMercadoPagoConnect({ businessId, returnTo: new URL(request.url).searchParams.get("returnTo") });
    const response = NextResponse.redirect(started.authorizationUrl, 302);
    response.headers.set("cache-control", "no-store");
    response.cookies.set(MP_OAUTH_COOKIE, started.cookie, cookie);
    return response;
  });
}
