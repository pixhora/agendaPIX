import { getBusinessBilling } from "@/lib/billing/status";
import { toBillingView } from "@/lib/dashboard/trial-notice";
import { BillingRefresh } from "./billing-refresh";
import { TrialBanner } from "./trial-banner";

/** Lê o mesmo formato de `GET /api/businesses/{businessId}/billing`. */
export async function OwnerBillingNotice({ ownerId, businessId, timeZone, publicSlug }: {
  ownerId: string;
  businessId: string;
  timeZone: string;
  publicSlug: string;
}) {
  const billing = toBillingView(await getBusinessBilling(businessId, ownerId));
  return <>
    <BillingRefresh businessId={businessId} pending={billing.checkout.pendingRequest !== null} active={billing.state === "active"} />
    <TrialBanner billing={billing} businessId={businessId} timeZone={timeZone} publicHref={`/${publicSlug}`} />
  </>;
}
