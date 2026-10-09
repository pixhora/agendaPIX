export async function register() {
  const { assertProductionSafeEnv } = await import("./lib/env");
  assertProductionSafeEnv();
  const { assertMpOAuthPkce } = await import("./lib/mercadopago-oauth/config");
  assertMpOAuthPkce();
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { registerSellerAccountHooks } = await import("./lib/payments/register-seller-hooks");
  registerSellerAccountHooks();
}
