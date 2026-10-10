import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnerSession } from "./auth-session";
import { ownedBusinesses } from "./data";

export const requireOwner = cache(async () => {
  const requestHeaders = await headers();
  const session = await getOwnerSession(requestHeaders);
  if (!session) redirect("/login");
  return session.user;
});

/** Mesma lista na moldura e na página, dentro de um único render. */
export const cachedOwnedBusinesses = cache((ownerId: string) => ownedBusinesses(ownerId));

export const ownerContext = cache(async (businessId?: string) => {
  const owner = await requireOwner();
  const businesses = await cachedOwnedBusinesses(owner.id);
  const business = businessId ? businesses.find((item) => item.id === businessId) : businesses[0];
  return { owner, businesses, business };
});
