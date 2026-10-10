import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { businesses, businessHours, onboardingRequests, services } from "../../db/schema";
import { trialEndsAtFromCreation } from "../billing/access";
import { requestKeySchema } from "../bookings/validation";
import { invalidatePublicCatalog } from "../bookings/public-cache";
import { HttpError } from "../http";
import { onboardingInputSchema } from "./validation";

export async function provisionBusiness(ownerId: string, key: unknown, body: unknown, database?: ReturnType<typeof getDb>) {
  const requestKey = requestKeySchema.parse(key);
  const input = onboardingInputSchema.parse(body);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  try {
    const outcome = await (database ?? getDb()).transaction(async (tx) => {
      const predicate = and(eq(onboardingRequests.ownerId, ownerId), eq(onboardingRequests.requestKey, requestKey));
      const inserted = await tx.insert(onboardingRequests).values({ ownerId, requestKey, requestHash }).onConflictDoNothing().returning();
      if (!inserted.length) {
        const [previous] = await tx.select().from(onboardingRequests).where(predicate);
        if (previous.requestHash !== requestHash) throw new HttpError(409, "idempotency_conflict", "Essa tentativa já foi usada com outros dados.");
        if (!previous.result) throw new HttpError(503, "onboarding_unavailable", "Não foi possível concluir o cadastro. Tente novamente.");
        return { result: previous.result, replay: true };
      }
      const [business] = await tx.insert(businesses).values({
        name: input.business.name,
        slug: input.business.slug,
        timezone: input.business.timezone,
        contactWhatsapp: input.business.contactWhatsapp ?? null,
        trialEndsAt: trialEndsAtFromCreation(new Date(), input.business.timezone),
        ownerId,
      }).onConflictDoNothing({ target: businesses.slug }).returning();
      if (!business) throw new HttpError(409, "slug_unavailable", "Esse endereço já está em uso. Escolha outro.");
      const [service] = await tx.insert(services).values({ ...input.service, businessId: business.id }).returning();
      await tx.insert(businessHours).values(input.hours.map((value) => ({ ...value, businessId: business.id })));
      const result = { businessId: business.id, slug: business.slug, publicPath: `/${business.slug}`, serviceId: service.id };
      await tx.update(onboardingRequests).set({ result }).where(predicate);
      return { result, replay: false };
    });
    await invalidatePublicCatalog(outcome.result.slug);
    return outcome;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "onboarding_unavailable", "Não foi possível concluir o cadastro. Tente novamente.");
  }
}
