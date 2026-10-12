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
 * (`withAppCors` segue sem Origin). Vazio ou diferente da lista: recusa.
 * O literal `null` só passa com `Sec-Fetch-Site: same-origin`. Não consulta Referer.
 */
export function isAllowedAppOrigin(request: Request, env: Readonly<Record<string, string | undefined>> = process.env) {
  const allowed = trustedAppOrigins(env);
  const raw = request.headers.get("origin");
  if (raw === null) return false;
  if (opaqueNullOriginAllowed(raw, request.headers.get("sec-fetch-site"))) return true;
  if (originEqualsAllowed(raw, allowed)) return true;
  logRejectedAppOrigin(raw, allowed);
  return false;
}

export function requireAppOrigin(request: Request) {
  if (!isAllowedAppOrigin(request)) {
    throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
  }
  return request.headers.get("origin") ?? "";
}

export async function withAppCors(request: Request, run: () => Promise<Response>) {
  let allowedOrigin: string | undefined;
  const response = await handleHttp(async () => {
    if (request.headers.has("origin")) allowedOrigin = requireAppOrigin(request);
    return run();
  });
  const headers = new Headers(response.headers);
  const vary = new Set((headers.get("vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  vary.add("Origin");
  headers.set("vary", [...vary].join(", "));
  headers.set("cache-control", "no-store");
  if (allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-credentials", "true");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function appPreflight(request: Request, methods: readonly string[]) {
  return withAppCors(request, async () => {
    requireAppOrigin(request);
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
  });
}
