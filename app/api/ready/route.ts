import { json } from "@/lib/http";
import { isReady } from "@/lib/readiness";

export const runtime = "nodejs";

export async function GET() {
  const ready = await isReady();
  return json({ status: ready ? "ready" : "unavailable" }, ready ? 200 : 503);
}
