import { getBackendOrigin } from "@/lib/backend";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const { slug } = await context.params;
  const searchParams = new URL(request.url).searchParams.toString();
  const backendUrl = `${getBackendOrigin()}/api/public/${slug}/availability${searchParams ? `?${searchParams}` : ""}`;

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
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
