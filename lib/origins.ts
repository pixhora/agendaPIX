import { configuredAppOrigins, logRejectedAppOrigin, opaqueNullOriginAllowed, originEqualsAllowed, pairedHostOrigin } from "./app-origins";
import { authEnvSchema } from "./env";
import { handleHttp, HttpError } from "./http";

export function trustedAppOrigins(env: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = authEnvSchema.safeParse(env);
  if (!parsed.success) throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  const canonical = new URL(parsed.data.BETTER_AUTH_URL).origin;
  const paired = pairedHostOrigin(canonical);
  const local = env.NODE_ENV === "production" ? [] : ["http://localhost:3000"];
  const allowed = [canonical];
  if (paired) {
    let seen = false;
    for (const current of allowed) {
      if (current === paired) seen = true;
    }
    if (!seen) allowed.push(paired);
  }
  for (const origin of [...configuredAppOrigins(env), ...local]) {
    if (!originEqualsAllowed(origin, allowed)) allowed.push(origin);
  }
  return allowed;
}

/**
 * Header cru, comparado à allowlist já normalizada. Ausente: recusa aqui
 * (`withAppCors` segue sem Origin). Vazio, `null` ou diferente da lista: recusa.
 * Não consulta Referer. `Origin: null` não entra por aqui.
 */
export function isAllowedAppOrigin(request: Request, env: Readonly<Record<string, string | undefined>> = process.env) {
  const allowed = trustedAppOrigins(env);
  const raw = request.headers.get("origin");
  if (raw === null) return false;
  if (originEqualsAllowed(raw, allowed)) return true;
  logRejectedAppOrigin(raw, allowed);
  return false;
}

/**
 * Só a criação de reserva pública e o pagamento do link de horário.
 * `Origin: null` com `Sec-Fetch-Site: same-origin` entra, mas não é origem para ecoar.
 */
export const publicPaymentOrigin = { allowOpaqueSameOrigin: true } as const;

export type AppOriginPolicy = { allowOpaqueSameOrigin?: boolean };

function opaqueSameOrigin(request: Request) {
  const raw = request.headers.get("origin");
  return raw !== null && opaqueNullOriginAllowed(raw, request.headers.get("sec-fetch-site"));
}

export function requireAppOrigin(request: Request, policy?: AppOriginPolicy) {
  if (policy?.allowOpaqueSameOrigin && opaqueSameOrigin(request)) return "";
  if (!isAllowedAppOrigin(request)) {
    throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
  }
  const raw = request.headers.get("origin") ?? "";
  return raw === "null" ? "" : raw;
}

function applyCors(headers: Headers, allowedOrigin: string | undefined, opaque: boolean) {
  if (opaque || allowedOrigin === "null" || headers.get("access-control-allow-origin") === "null") {
    headers.delete("access-control-allow-origin");
    headers.delete("access-control-allow-credentials");
  }
  if (!opaque && allowedOrigin && allowedOrigin !== "null") {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-credentials", "true");
  }
}

export async function withAppCors(request: Request, run: () => Promise<Response>, policy?: AppOriginPolicy) {
  let allowedOrigin: string | undefined;
  const opaque = Boolean(policy?.allowOpaqueSameOrigin && opaqueSameOrigin(request));
  const response = await handleHttp(async () => {
    if (request.headers.has("origin")) allowedOrigin = requireAppOrigin(request, policy);
    return run();
  });
  const headers = new Headers(response.headers);
  const vary = new Set((headers.get("vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  vary.add("Origin");
  headers.set("vary", [...vary].join(", "));
  headers.set("cache-control", "no-store");
  applyCors(headers, allowedOrigin, opaque);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function appPreflight(request: Request, methods: readonly string[], policy?: AppOriginPolicy) {
  return withAppCors(request, async () => {
    requireAppOrigin(request, policy);
    const method = request.headers.get("access-control-request-method") ?? "";
    const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!methods.includes(method) || requestedHeaders.some((value) => !["content-type", "authorization", "idempotency-key"].includes(value))) {
      throw new HttpError(403, "cors_not_allowed", "Solicitação não permitida.");
    }
    return new Response(null, { status: 204, headers: {
      "access-control-allow-methods": methods.join(", "),
      "access-control-allow-headers": "Content-Type, Authorization, Idempotency-Key",
      vary: "Access-Control-Request-Method, Access-Control-Request-Headers",
    } });
  }, policy);
}
