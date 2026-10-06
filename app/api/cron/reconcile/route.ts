import { handleHttp, json } from "@/lib/http";
import { authorizeCron, runReconcilePass } from "@/lib/payments/cron";

// Substitui o worker `reconcile` (loop) em ambiente sem servidor: Vercel Cron chama GET; agendadores externos podem usar POST.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  return handleHttp(async () => {
    authorizeCron(request.headers.get("authorization"));
    return json({ at: new Date().toISOString(), ...(await runReconcilePass()) });
  });
}

export const GET = handle;
export const POST = handle;
