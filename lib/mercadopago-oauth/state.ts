import { createHmac } from "node:crypto";
import { z } from "zod";
import { safeEqualString } from "./timing";

export const MP_OAUTH_COOKIE = "mp_oauth";
export const MP_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

const attemptFields = {
  state: z.string().min(32).max(128),
  businessId: z.uuid(),
  returnTo: z.string().min(1).max(512),
  exp: z.number().int(),
};

const payloadSchema = z.discriminatedUnion("pkce", [
  z.object({ ...attemptFields, pkce: z.literal(true), verifier: z.string().min(43).max(128) }).strict(),
  z.object({ ...attemptFields, pkce: z.literal(false) }).strict(),
]);

export type MpOAuthCookie = z.infer<typeof payloadSchema>;

export function sealMpOAuthState(payload: MpOAuthCookie, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function openMpOAuthState(token: string, secret: string, now = Date.now()): { ok: true; payload: MpOAuthCookie } | { ok: false; reason: "state_mismatch" | "expired" } {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "state_mismatch" };
  const encoded = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!safeEqualString(mac, expected)) return { ok: false, reason: "state_mismatch" };
  try {
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (payload.exp <= now) return { ok: false, reason: "expired" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "state_mismatch" };
  }
}

export function readCookie(header: string | null, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); }
    catch { return undefined; }
  }
  return undefined;
}
