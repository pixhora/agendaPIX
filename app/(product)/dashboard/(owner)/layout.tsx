import { AppFrame } from "@/components/dashboard/app-frame";
import { ownedBusinesses } from "@/lib/dashboard/data";
import { requireOwner } from "@/lib/dashboard/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  const businesses = await ownedBusinesses(owner.id);
  return <AppFrame ownerName={owner.name} businesses={businesses.map(({ id, name, slug }) => ({ id, name, slug }))}>{children}</AppFrame>;
}
