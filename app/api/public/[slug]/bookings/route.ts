import { appPreflight, withAppCors } from "@/lib/origins";
import { createBooking } from "@/lib/bookings/service";
import { json, readBody } from "@/lib/http";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { setBookingCookie } from "@/lib/bookings/cookies";
import { bookingConfig } from "@/lib/bookings/config";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  return withAppCors(request, async () => {
    const result = await createBooking((await context.params).slug, JSON.parse(await readBody(request)), request.headers.get("idempotency-key"), undefined, undefined, bookingClientIdentity(request));
    const config = bookingConfig();
    const cookieMaxAge = result.data.expiresAt ? Math.max(1, Math.ceil((result.data.expiresAt.getTime() - Date.now()) / 1000)) : config.BOOKING_HOLD_MINUTES * 60;
    // Include accessToken in response body for transition period (frontend still expects it)
    // Cookie is also set for gradual migration to cookie-only auth
    const response = json({ ...result.data, accessToken: result.token }, result.replayed ? 200 : 201);
    response.headers.set("Set-Cookie", setBookingCookie(result.token, { maxAge: cookieMaxAge }));
    return response;
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["POST"]); }
