import { purgeExpiredSlotLinkLabels } from "@/lib/bookings/slot-link";
import { handleHttp, json } from "@/lib/http";
import { deleteExpiredOnboardingDrafts } from "@/lib/onboarding/drafts";
import { authorizeCron, runCronTick, runReconcilePass } from "@/lib/payments/cron";

// Substitui o worker `reconcile` (loop) em ambiente sem servidor: Vercel Cron chama GET; agendadores externos podem usar POST.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  return handleHttp(async () => {
    authorizeCron(request.headers.get("authorization"));
    return json(await runCronTick({
      deleteExpiredDrafts: () => deleteExpiredOnboardingDrafts(),
      purgeSlotLinkLabels: () => purgeExpiredSlotLinkLabels(),
      reconcile: () => runReconcilePass(),
      onDraftCleanupError: (code) => {
        console.error(`[reconcile] stage=draft_cleanup code=${code}`);
      },
      onSlotLinkLabelError: (code) => {
        console.error(`[reconcile] stage=slot_link_labels code=${code}`);
      },
    }));
  });
}

export const GET = handle;
export const POST = handle;
