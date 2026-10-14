import { handleHttp, json } from "@/lib/http";
import { authorizeCron } from "@/lib/payments/cron";
import { createDrizzleWeeklySummaryPorts, runWeeklySummaries } from "@/lib/dashboard/weekly-summary";

// Segunda de manhã (vercel.json). Repetir a chamada é seguro: cada negócio recebe um e-mail por semana.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  return handleHttp(async () => {
    authorizeCron(request.headers.get("authorization"));
    return json({ at: new Date().toISOString(), ...(await runWeeklySummaries(createDrizzleWeeklySummaryPorts())) });
  });
}

export const GET = handle;
export const POST = handle;
