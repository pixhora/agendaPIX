export async function register() {
  const { assertMpOAuthPkce } = await import("./lib/mercadopago-oauth/config");
  assertMpOAuthPkce();
}
