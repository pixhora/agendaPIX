const retired = () => Response.json(
  { error: { code: "pix_key_retired" } },
  { status: 410, headers: { "cache-control": "no-store" } },
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = retired;
export const POST = retired;
export const PUT = retired;
export const PATCH = retired;
export const DELETE = retired;
export const HEAD = retired;
export const OPTIONS = retired;
