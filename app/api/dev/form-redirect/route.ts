import { z } from "zod";

const targetSchema = z.enum(["wa", "blocked"]);

const TARGETS = {
  wa: "https://wa.me/5511900000000",
  blocked: "https://example.com/",
} as const;

/**
 * Dev-only form target. E2E posts here and expects a 303 so Chromium applies
 * `form-action` to the redirect. The destination is a fixed enum, not a URL
 * from the client. Hidden unless the fake provider is running outside production.
 */
export function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER !== "fake") {
    return new Response(null, { status: 404 });
  }
  const parsed = targetSchema.safeParse(new URL(request.url).searchParams.get("to"));
  if (!parsed.success) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 303,
    headers: { Location: TARGETS[parsed.data] },
  });
}
