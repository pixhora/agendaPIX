import { getAuth } from "@/lib/auth";
import { appPreflight, withAppCors } from "@/lib/origins";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withAppCors(request, async () => getAuth().handler(request));
}

export async function POST(request: Request) {
  return withAppCors(request, async () => getAuth().handler(request));
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET", "POST"]);
}
