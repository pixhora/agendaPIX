import { getBusinessBilling } from "@/lib/billing/status";
import { toBillingView, type BillingView } from "@/lib/dashboard/trial-notice";
import { BillingRefresh } from "./billing-refresh";
import { TrialBanner } from "./trial-banner";

type BillingSource = Parameters<typeof toBillingView>[0];

/** Lê o mesmo formato de `GET /api/businesses/{businessId}/billing`. */
export async function OwnerBillingNotice({ ownerId, businessId, timeZone, publicSlug, billing }: {
  ownerId: string;
  businessId: string;
  timeZone: string;
  publicSlug: string;
  billing?: BillingSource;
}) {
  const view: BillingView = toBillingView(billing ?? await getBusinessBilling(businessId, ownerId));
  return <>
    <BillingRefresh businessId={businessId} pending={view.checkout.pendingRequest !== null} active={view.state === "active"} />
    <TrialBanner billing={view} businessId={businessId} timeZone={timeZone} publicHref={`/${publicSlug}`} />
  </>;
}
