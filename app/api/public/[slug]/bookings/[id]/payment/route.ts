import { getBackendOrigin } from "@/lib/backend";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  const { slug, id } = await context.params;
  const backendUrl = `${getBackendOrigin()}/api/public/${slug}/bookings/${id}/payment`;

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers["authorization"] = authorization;
  }

  try {
    const res = await fetch(backendUrl, {
      headers,
      cache: "no-store",
    });
    const body = await res.text();
    return new Response(body, {
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
