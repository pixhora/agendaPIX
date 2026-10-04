import { getBackendOrigin } from "@/lib/backend";

export async function POST(request: Request, context: RouteContext<"/api/public/[slug]/bookings">) {
  const { slug } = await context.params;
  const backendUrl = `${getBackendOrigin()}/api/public/${slug}/bookings`;
  const body = await request.text();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers["authorization"] = authorization;
  }

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: { code: "backend_unavailable", message: "Serviço temporariamente indisponível." } },
      { status: 503 }
    );
  }
}
