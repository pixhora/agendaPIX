import { handleHttp } from "../http";
import { sanitizeMpReturnTo } from "../mercadopago-oauth/return-to";

/** Mesma frase de `mp_oauth_unconfigured`. O dono não vê código nem nome de variável. */
export const MP_CONNECT_CONFIG_COPY = "A conexão com o Mercado Pago ainda não está configurada.";

const CONFIG_ERROR_CODES = new Set(["mp_oauth_pkce_invalid", "mp_oauth_unconfigured"]);

export function ownerConnectConfigCopy(code: string | null | undefined): string | null {
  return code && CONFIG_ERROR_CODES.has(code) ? MP_CONNECT_CONFIG_COPY : null;
}

function browserNavigation(request: Request) {
  const accept = (request.headers.get("accept") ?? "").toLowerCase();
  if (accept.includes("application/json")) return false;
  if ((request.headers.get("sec-fetch-dest") ?? "").toLowerCase() === "document") return true;
  return accept.includes("text/html");
}

function backHref(returnTo: unknown) {
  const pathname = sanitizeMpReturnTo(returnTo).split(/[?#]/)[0] ?? "";
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/") ? "/onboarding" : "/dashboard";
}

async function readReturnTo(request: Request) {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      const body = await request.json() as { returnTo?: unknown };
      return body?.returnTo;
    }
    if (type.includes("application/x-www-form-urlencoded")) {
      return new URLSearchParams(await request.text()).get("returnTo");
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function configErrorPage(returnTo: unknown) {
  const href = escapeHtml(backHref(returnTo));
  const copy = escapeHtml(MP_CONNECT_CONFIG_COPY);
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Conexão indisponível</title>
<style>
  :root { color-scheme: light; --paper: #f6f5f2; --ink: #0b0b0c; --muted: #5b5b5f; --pix: #0a6e63; --pix-foreground: #ffffff; }
  @media (prefers-color-scheme: dark) {
    :root { color-scheme: dark; --paper: #0f0f10; --ink: #f6f5f2; --muted: #b5b5b8; --pix: #0a6e63; --pix-foreground: #ffffff; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: var(--paper); color: var(--ink); font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
  main { width: min(100%, 28rem); padding: 1.5rem; }
  h1 { margin: 0; font-size: 1.75rem; line-height: 1.2; letter-spacing: -0.02em; }
  p { margin: 0.75rem 0 0; max-width: 36rem; font-size: 1rem; line-height: 1.5; color: var(--muted); }
  a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 1.5rem; padding: 0 1.25rem; border-radius: 12px; background: var(--pix); color: var(--pix-foreground); font-weight: 700; text-decoration: none; }
  a:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>Conexão indisponível</h1>
  <p>${copy}</p>
  <a href="${href}">Voltar</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Sucesso do connect continua 303. `mp_oauth_pkce_invalid` não redireciona:
 * o backend responde 503 JSON. Na navegação do formulário, o dono vê a frase
 * genérica de configuração, sem o código.
 */
export async function presentOwnerConnectResponse(request: Request, response: Response) {
  if (!browserNavigation(request) || response.status !== 503) return response;
  const payload = await response.clone().json().catch(() => null) as { error?: { code?: unknown } } | null;
  const code = typeof payload?.error?.code === "string" ? payload.error.code : null;
  if (!ownerConnectConfigCopy(code)) return response;
  return configErrorPage(await readReturnTo(request));
}

export async function respondMercadoPagoConnect(request: Request, run: () => Promise<Response>) {
  const navigation = request.clone();
  const response = await handleHttp(run);
  return presentOwnerConnectResponse(navigation, response);
}
