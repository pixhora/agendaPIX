import { AppFrame } from "@/components/dashboard/app-frame";
import { businessesWithDeposit } from "@/lib/dashboard/data";
import { cachedOwnedBusinesses, requireOwner } from "@/lib/dashboard/session";

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
  return <AppFrame ownerName={owner.name} businesses={framed}>{children}</AppFrame>;
}
