import { getAuth } from "../auth";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";

export async function sessionOwnerId(request: Request) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return session?.user?.id ?? null;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "auth_unavailable", "O acesso ao AgendaPix está indisponível. Tente novamente mais tarde.");
  }
}

export async function requireBusinessOwner(request: Request, businessId: string) {
  const ownerId = await sessionOwnerId(request);
  if (!ownerId) throw new HttpError(401, "unauthorized", "Entre na sua conta para continuar.");
  const business = await findOwnedBusiness(businessId, ownerId);
  if (!business) throw new HttpError(404, "business_unavailable", "Este negócio não está disponível para sua conta.");
  return ownerId;
}
