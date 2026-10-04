import { getBackendOrigin } from "@/lib/backend";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const { slug } = await context.params;
  const search = new URL(request.url).search;
  const backendUrl = `${getBackendOrigin()}/api/public/${slug}/availability${search}`;
  try {
    const res = await fetch(backendUrl, {
      headers: {
        accept: "application/json",
      },
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
