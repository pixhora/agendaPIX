import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { HttpError, json } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { subscriptionCheckoutBlocked } from "./access";
import { loadSubscription } from "./load";
import { activeSubscriptionProvider } from "./providers";
import { publicBusinessPageUrl } from "./public-url";
import { openSubscriptionRequest } from "./requests";

type Database = Pick<NodePgDatabase<typeof schema>, "select" | "insert">;
type CheckoutEnv = Readonly<Record<string, string | undefined>>;

export type SubscriptionCheckoutResult = {
  provider: "manual";
  request: { id: string; requestedAt: string };
  whatsappUrl: string;
  activationHours: number;
};

const unavailable = () => new HttpError(503, "checkout_unavailable", "A assinatura por aqui está indisponível no momento.");

export async function startSubscriptionCheckout(
  businessId: string,
  ownerId: string,
  database: Database = getDb(),
  env: CheckoutEnv = process.env,
  now = new Date(),
): Promise<SubscriptionCheckoutResult> {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  const provider = activeSubscriptionProvider(env);
  if (!provider.isAvailable() || provider.id !== "manual") throw unavailable();
  const publicUrl = publicBusinessPageUrl(business.slug, env);
  if (!publicUrl) throw unavailable();
  const subscription = await loadSubscription(business.id, database);
  if (subscriptionCheckoutBlocked(subscription, business.timezone, now)) {
    throw new HttpError(409, "subscription_already_active", "Sua assinatura já está ativa.");
  }
  const request = await openSubscriptionRequest(business.id, provider.id, database);
  const started = provider.startCheckout({ publicUrl });
  if (started.provider !== "manual") throw unavailable();
  return {
    provider: "manual",
    request: { id: request.id, requestedAt: request.requestedAt.toISOString() },
    whatsappUrl: started.whatsappUrl,
    activationHours: started.activationHours,
  };
}

/** Form sem `Accept: application/json` redireciona. O resto, inclusive erro, fica no handler HTTP. */
export function requestWantsJson(request: Request) {
  return (request.headers.get("accept") ?? "").toLowerCase().includes("application/json");
}

export function subscriptionCheckoutResponse(request: Request, result: SubscriptionCheckoutResult) {
  if (!requestWantsJson(request)) return Response.redirect(result.whatsappUrl, 303);
  return json(result);
}
