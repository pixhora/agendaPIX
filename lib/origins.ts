import { authEnvSchema } from "./env";
import { handleHttp, HttpError } from "./http";

export function trustedAppOrigins() {
  const env = authEnvSchema.safeParse(process.env);
  if (!env.success) throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  const origin = new URL(env.data.BETTER_AUTH_URL).origin;
  const local = process.env.NODE_ENV === "production" ? [] : [3000, 3001, 3005, 3343].map((port) => `http://localhost:${port}`);
  return [...new Set([origin, ...local])];
}

export function requireAppOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !trustedAppOrigins().includes(origin)) {
    throw new HttpError(403, "origin_not_allowed", "Origem da solicitação não permitida.");
  }
  return origin;
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
    if (!methods.includes(method) || requestedHeaders.some((value) => !["content-type", "authorization"].includes(value))) {
      throw new HttpError(403, "cors_not_allowed", "Solicitação não permitida.");
    }
    return new Response(null, { status: 204, headers: {
      "access-control-allow-methods": methods.join(", "),
      "access-control-allow-headers": "Content-Type, Authorization",
      vary: "Access-Control-Request-Method, Access-Control-Request-Headers",
    } });
  });
}
