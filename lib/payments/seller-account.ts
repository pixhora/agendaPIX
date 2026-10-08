import { z } from "zod";

/** Token do dono no Mercado Pago, no formato que o PR de OAuth devolve. */
export type SellerAccess = { accessToken: string; mpUserId: string };

/**
 * O PR de OAuth implementa estas funções. Aqui elas só entram por gancho.
 * `null` significa conta desconectada, sem token, ou token que o Mercado Pago desvinculou.
 */
export type GetSellerAccessToken = (businessId: string) => Promise<SellerAccess | null>;
export type GetSellerAccessTokenForSettlement = (businessId: string) => Promise<SellerAccess | null>;
export type FindBusinessIdByMpUserId = (mpUserId: string) => Promise<string | null>;

export class MpAccountNotConnectedError extends Error {
  readonly code = "mp_account_not_connected";
  constructor() {
    super("Conta Mercado Pago desconectada.");
    this.name = "MpAccountNotConnectedError";
  }
}

type SellerHooks = {
  getSellerAccessToken?: GetSellerAccessToken;
  getSellerAccessTokenForSettlement?: GetSellerAccessTokenForSettlement;
  findBusinessIdByMpUserId?: FindBusinessIdByMpUserId;
};

let hooks: SellerHooks = {};

export function setSellerAccountHooks(next: SellerHooks) {
  hooks = next;
}

export function resetSellerAccountHooks() {
  hooks = {};
}

export function sellerHooksActive() {
  return Boolean(hooks.getSellerAccessToken || hooks.getSellerAccessTokenForSettlement || hooks.findBusinessIdByMpUserId);
}

export type MpAccessPurpose = "charge" | "settlement";

export type MpAccessTokenQuery = {
  businessId?: string;
  mpUserId?: string;
  purpose?: MpAccessPurpose;
};

function platformToken(env: Readonly<Record<string, string | undefined>>) {
  return z.string().min(1).refine((value) => !value.startsWith("replace-this-")).parse(env.MERCADOPAGO_ACCESS_TOKEN);
}

/**
 * Único ponto que o código de pagamento usa para obter o token.
 * Sem gancho, as duas finalidades devolvem o token da plataforma e ignoram a consulta.
 * Com gancho, `charge` usa `getSellerAccessToken` e `settlement` usa `getSellerAccessTokenForSettlement`.
 * Se só houver `mpUserId`, `findBusinessIdByMpUserId` acha o negócio. Gancho que devolve null não cai no token da plataforma.
 */
export async function resolveMpAccessToken(
  query: MpAccessTokenQuery,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<string> {
  if (!sellerHooksActive()) return platformToken(env);

  const businessId = query.businessId
    ?? (query.mpUserId && hooks.findBusinessIdByMpUserId ? await hooks.findBusinessIdByMpUserId(query.mpUserId) : null);
  if (!businessId) throw new MpAccountNotConnectedError();

  const purpose = query.purpose ?? "charge";
  const hook = purpose === "charge" ? hooks.getSellerAccessToken : hooks.getSellerAccessTokenForSettlement;
  const seller = hook ? await hook(businessId) : null;
  if (!seller?.accessToken) throw new MpAccountNotConnectedError();
  return seller.accessToken;
}

/** Dono desconectado, mas ainda com token retido para liquidar. Sem gancho, não avisa. */
export async function isSellerDisconnected(businessId: string, env: Readonly<Record<string, string | undefined>> = process.env) {
  if (!sellerHooksActive()) return false;
  try {
    await resolveMpAccessToken({ businessId, purpose: "charge" }, env);
    return false;
  } catch (error) {
    if (!(error instanceof MpAccountNotConnectedError)) throw error;
  }
  try {
    await resolveMpAccessToken({ businessId, purpose: "settlement" }, env);
    return true;
  } catch (error) {
    if (error instanceof MpAccountNotConnectedError) return false;
    throw error;
  }
}

/** Sem gancho de OAuth o provedor usa o próprio token. Com gancho, `false` bloqueia o estorno. */
export async function settlementAvailable(businessId: string, env: Readonly<Record<string, string | undefined>> = process.env) {
  if (!sellerHooksActive()) return true;
  try {
    await resolveMpAccessToken({ businessId, purpose: "settlement" }, env);
    return true;
  } catch (error) {
    if (error instanceof MpAccountNotConnectedError) return false;
    throw error;
  }
}
