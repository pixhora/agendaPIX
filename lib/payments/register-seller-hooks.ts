import {
  findBusinessIdByMpUserId,
  getSellerAccessToken,
  getSellerAccessTokenForSettlement,
} from "../mercadopago-oauth/credentials";
import { setSellerAccountHooks } from "./seller-account";

/**
 * Liga o OAuth do dono à cobrança do sinal. Sem este registro, `resolveMpAccessToken`
 * devolve o token da plataforma. A assinatura do AgendaPix não passa por aqui.
 */
export function registerSellerAccountHooks() {
  setSellerAccountHooks({
    getSellerAccessToken: (businessId) => getSellerAccessToken(businessId),
    getSellerAccessTokenForSettlement: (businessId) => getSellerAccessTokenForSettlement(businessId),
    findBusinessIdByMpUserId: (mpUserId) => findBusinessIdByMpUserId(mpUserId),
  });
}
