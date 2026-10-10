import { AppFrame } from "@/components/dashboard/app-frame";
import { businessesWithDeposit } from "@/lib/dashboard/data";
import { cachedOwnedBusinesses, rememberedBusinessId, requireOwner } from "@/lib/dashboard/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  const businesses = await cachedOwnedBusinesses(owner.id);
  const deposits = await businessesWithDeposit(businesses.map((business) => business.id));
  const framed = businesses.map((business) => ({
    id: business.id,
    name: business.name,
    slug: business.slug,
    hasDepositService: deposits.has(business.id),
  }));
  const rememberedId = await rememberedBusinessId();
  const defaultBusinessId = framed.find((business) => business.id === rememberedId)?.id;
  return <AppFrame ownerName={owner.name} businesses={framed} defaultBusinessId={defaultBusinessId}>{children}</AppFrame>;
}
