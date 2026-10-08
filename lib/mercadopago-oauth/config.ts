import { authEnvSchema, mercadoPagoOAuthEnvSchema } from "../env";
import { HttpError } from "../http";

/** Host do guia de Split. A doc geral de OAuth usa https://auth.mercadopago.com/authorization. */
export const MP_AUTHORIZE_URL_DEFAULT = "https://auth.mercadopago.com.br/authorization";
/** Único endpoint OAuth documentado. */
export const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
export const MP_TOKEN_TIMEOUT_MS = 8000;

export type MpOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  authorizeUrl: string;
  authSecret: string;
  origin: string;
};

function httpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  return url;
}

export function mpOAuthConfig(env: Readonly<Record<string, string | undefined>> = process.env): MpOAuthConfig {
  const oauth = mercadoPagoOAuthEnvSchema.safeParse(env);
  const auth = authEnvSchema.safeParse(env);
  if (!oauth.success || !auth.success) {
    throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
  }
  const authorize = httpsUrl(oauth.data.MP_OAUTH_AUTHORIZE_URL ?? MP_AUTHORIZE_URL_DEFAULT);
  if (!authorize) throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
  return {
    clientId: oauth.data.MP_CLIENT_ID,
    clientSecret: oauth.data.MP_CLIENT_SECRET,
    redirectUri: oauth.data.MP_OAUTH_REDIRECT_URI,
    encryptionKey: oauth.data.MP_TOKEN_ENCRYPTION_KEY,
    authorizeUrl: `${authorize.origin}${authorize.pathname}`,
    authSecret: auth.data.BETTER_AUTH_SECRET,
    origin: new URL(auth.data.BETTER_AUTH_URL).origin,
  };
}

export function webhookSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
  if (secret.length < 32 || secret.startsWith("replace-this-")) {
    throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
  }
  return secret;
}
