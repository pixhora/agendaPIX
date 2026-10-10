import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnerSession } from "./auth-session";
import { ACTIVE_BUSINESS_COOKIE, resolveBusiness } from "./active-business";
import { ownedBusinesses } from "./data";

export const requireOwner = cache(async () => {
  const requestHeaders = await headers();
  const session = await getOwnerSession(requestHeaders);
  if (!session) redirect("/login");
  return session.user;
});

/** Mesma lista na moldura e na página, dentro de um único render. */
export const cachedOwnedBusinesses = cache((ownerId: string) => ownedBusinesses(ownerId));

export async function rememberedBusinessId(): Promise<string | undefined> {
  return (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
}

export const ownerContext = cache(async (businessId?: string) => {
  const owner = await requireOwner();
  const businesses = await cachedOwnedBusinesses(owner.id);
  const business = resolveBusiness(businesses, businessId, await rememberedBusinessId());
  return { owner, businesses, business };
});
