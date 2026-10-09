import { AppFrame } from "@/components/dashboard/app-frame";
import { dashboardServices, ownedBusinesses } from "@/lib/dashboard/data";
import { requireOwner } from "@/lib/dashboard/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  const businesses = await ownedBusinesses(owner.id);
  const framed = await Promise.all(businesses.map(async (business) => {
    const rows = await dashboardServices(owner.id, business.id);
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      hasDepositService: rows.some((service) => service.active && service.depositCents > 0),
    };
  }));
  return <AppFrame ownerName={owner.name} businesses={framed}>{children}</AppFrame>;
}
