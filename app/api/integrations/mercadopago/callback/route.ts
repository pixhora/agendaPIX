import { NextResponse } from "next/server";
import { handleHttp } from "@/lib/http";
import { mpOAuthConfig } from "@/lib/mercadopago-oauth/config";
import { completeMercadoPagoConnect, redirectUrl, requestClientIp } from "@/lib/mercadopago-oauth/flow";
import { sessionOwnerId } from "@/lib/mercadopago-oauth/owner";
import { MP_OAUTH_COOKIE, readCookie } from "@/lib/mercadopago-oauth/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleHttp(async () => {
    const config = mpOAuthConfig();
    const finished = await completeMercadoPagoConnect({
      requestUrl: request.url,
      cookie: readCookie(request.headers.get("cookie"), MP_OAUTH_COOKIE),
      ownerId: await sessionOwnerId(request),
      clientIp: requestClientIp(request),
    });
    const response = NextResponse.redirect(redirectUrl(finished.path, config), 302);
    response.headers.set("cache-control", "no-store");
    response.cookies.set(MP_OAUTH_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  });
}
