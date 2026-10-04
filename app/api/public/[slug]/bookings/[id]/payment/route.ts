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
      method: "GET",
      headers,
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
