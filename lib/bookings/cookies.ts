import { authEnvSchema } from "../env";

const BOOKING_COOKIE_NAME = "booking_access";

interface CookieOptions {
  maxAge?: number;
  delete?: boolean;
}

/**
 * Cria cookie HttpOnly + Secure + SameSite=Strict para autenticação de booking.
 * Em produção (HTTPS), Secure é obrigatório. Em dev (HTTP), Secure é omitido.
 */
export function setBookingCookie(token: string, options: CookieOptions = {}): string {
  const env = authEnvSchema.parse(process.env);
  const isSecure = new URL(env.BETTER_AUTH_URL).protocol === "https:";
  
  const parts = [`${BOOKING_COOKIE_NAME}=${options.delete ? "" : token}`];
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("SameSite=Strict");
  
  if (isSecure) {
    parts.push("Secure");
  }
  
  if (options.delete) {
    parts.push("Max-Age=0");
  } else if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  
  return parts.join("; ");
}

/**
 * Extrai o token de acesso do cookie ou header Authorization.
 * Prioriza cookie (mais seguro), fallback para Bearer header (transição).
 */
export function extractBookingToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = new RegExp(`(?:^|;)\\s*${BOOKING_COOKIE_NAME}=([^;]+)`).exec(cookieHeader);
    if (match?.[1]) {
      return match[1];
    }
  }
  
  const authHeader = request.headers.get("authorization");
  const bearerMatch = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authHeader ?? "");
  return bearerMatch?.[1] ?? null;
}

/**
 * Cria header Set-Cookie para limpar o cookie de booking.
 */
export function clearBookingCookie(): string {
  return setBookingCookie("", { delete: true });
}
