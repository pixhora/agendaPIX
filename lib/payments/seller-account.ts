import { z } from "zod";

/** Conta do dono no Mercado Pago, do ponto de vista do AgendaPix. */
export type SellerLinkState = "connected" | "disconnected" | "unlinked";

/**
 * O PR de OAuth implementa isto. Devolve o token retido para liquidar um Pix já criado,
 * mesmo depois que o dono desconectou a conta. `null` significa que o Mercado Pago desvinculou o token.
 */
export type GetSellerAccessTokenForSettlement = (businessId: string) => Promise<string | null>;
export type GetSellerLinkState = (businessId: string) => Promise<SellerLinkState>;

export class MpAccountNotConnectedError extends Error {
  readonly code = "mp_account_not_connected";
  constructor() {
    super("Conta Mercado Pago desconectada.");
    this.name = "MpAccountNotConnectedError";
  }
}

type SellerHooks = {
  getSellerAccessTokenForSettlement?: GetSellerAccessTokenForSettlement;
  getSellerLinkState?: GetSellerLinkState;
};

let hooks: SellerHooks = {};

export function setSellerAccountHooks(next: SellerHooks) {
  hooks = next;
}

export function resetSellerAccountHooks() {
  hooks = {};
}

export function sellerHooksActive() {
  return Boolean(hooks.getSellerAccessTokenForSettlement || hooks.getSellerLinkState);
}

export async function getSellerLinkState(businessId: string): Promise<SellerLinkState> {
  if (!hooks.getSellerLinkState) return "connected";
  return hooks.getSellerLinkState(businessId);
}

export async function getSellerAccessTokenForSettlement(businessId: string): Promise<string | null> {
  if (!hooks.getSellerAccessTokenForSettlement) return null;
  return hooks.getSellerAccessTokenForSettlement(businessId);
}

export type MpAccessPurpose = "charge" | "settlement";

export type MpAccessTokenQuery = {
  businessId?: string;
  mpUserId?: string;
  purpose?: MpAccessPurpose;
};

/**
 * Hoje, sem o gancho de OAuth, as duas finalidades devolvem o token da plataforma.
 * `charge` falha se o dono estiver desconectado. `settlement` pode usar o token retido.
 */
export async function resolveMpAccessToken(
  query: MpAccessTokenQuery,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<string> {
  const purpose = query.purpose ?? "charge";
  const platform = () => z.string().min(1).refine((value) => !value.startsWith("replace-this-")).parse(env.MERCADOPAGO_ACCESS_TOKEN);
  const state = query.businessId ? await getSellerLinkState(query.businessId) : "connected";

  if (purpose === "charge") {
    if (state !== "connected") throw new MpAccountNotConnectedError();
    return platform();
  }

  if (state === "unlinked") throw new MpAccountNotConnectedError();
  if (state === "disconnected") {
    if (!query.businessId) throw new MpAccountNotConnectedError();
    const retained = await getSellerAccessTokenForSettlement(query.businessId);
    if (!retained) throw new MpAccountNotConnectedError();
    return retained;
  }
  if (query.businessId && hooks.getSellerAccessTokenForSettlement) {
    const token = await getSellerAccessTokenForSettlement(query.businessId);
    if (token) return token;
  }
  return platform();
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
