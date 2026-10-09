/**
 * Esqueleto do Pix mensal. Não está registrado em `providers/index.ts` e o checkout não o chama.
 * A cobrança futura usa somente o token da plataforma, na variável MERCADOPAGO_ACCESS_TOKEN.
 * Nunca o token OAuth de um dono.
 */
export const PIX_PLATFORM_PROVIDER_ID = "pix_platform" as const;

const PLATFORM_ACCESS_TOKEN_ENV = "MERCADOPAGO_ACCESS_TOKEN";

export function readPlatformSubscriptionAccessToken(env: Record<string, string | undefined>) {
  const token = env[PLATFORM_ACCESS_TOKEN_ENV]?.trim() ?? "";
  if (!token || token.startsWith("replace-this-")) return null;
  return token;
}
