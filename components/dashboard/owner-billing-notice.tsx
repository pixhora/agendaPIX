import { getBusinessBilling } from "@/lib/billing/status";
import { toBillingView } from "@/lib/dashboard/trial-notice";
import { TrialBanner } from "./trial-banner";

/** Lê o mesmo formato de `GET /api/businesses/{businessId}/billing`. */
export async function OwnerBillingNotice({ ownerId, businessId, timeZone, publicSlug }: {
  ownerId: string;
  businessId: string;
  timeZone: string;
  publicSlug: string;
}) {
  const billing = await getBusinessBilling(businessId, ownerId);
  return <TrialBanner billing={toBillingView(billing)} timeZone={timeZone} publicHref={`/${publicSlug}`} />;
}
