import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../auth";
import { ownedBusinesses } from "./data";

export async function requireOwner() {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/dashboard/login");
  return session.user;
}
export async function ownerContext(businessId?: string) {
  const owner = await requireOwner();
  const businesses = await ownedBusinesses(owner.id);
  const business = businessId ? businesses.find((item) => item.id === businessId) : businesses[0];
  return { owner, businesses, business };
}
