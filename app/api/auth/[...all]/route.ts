import { getAuth } from "@/lib/auth";
import { handleHttp } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleHttp(async () => getAuth().handler(request));
}

export async function POST(request: Request) {
  return handleHttp(async () => getAuth().handler(request));
}
