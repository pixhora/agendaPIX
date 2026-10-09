import { NextResponse } from "next/server";
import { handleHttp } from "../http";
import { sanitizeMpReturnTo } from "../mercadopago-oauth/return-to";

export const MP_CONNECT_UNAVAILABLE_TITLE = "Conexão indisponível";

/** Frase da página de navegação. O dono não vê código nem nome de variável. */
export const MP_CONNECT_UNAVAILABLE_COPY = "Não deu para conectar ao Mercado Pago agora. Tente de novo em alguns minutos.";

const CONFIG_ERROR_CODES = new Set(["mp_oauth_pkce_invalid", "mp_oauth_unconfigured"]);

export function ownerConnectConfigCopy(code: string | null | undefined): string | null {
  return code && CONFIG_ERROR_CODES.has(code) ? MP_CONNECT_UNAVAILABLE_COPY : null;
}

function browserNavigation(request: Request) {
  const accept = (request.headers.get("accept") ?? "").toLowerCase();
  if (accept.includes("application/json")) return false;
  if ((request.headers.get("sec-fetch-dest") ?? "").toLowerCase() === "document") return true;
  return accept.includes("text/html");
}

export function connectUnavailableBackHref(returnTo: unknown) {
  const pathname = sanitizeMpReturnTo(returnTo).split(/[?#]/)[0] ?? "";
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/") ? "/onboarding" : "/dashboard";
}

export function connectUnavailablePath(returnTo: unknown) {
  return `/mercadopago/indisponivel?returnTo=${encodeURIComponent(connectUnavailableBackHref(returnTo))}`;
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

function unavailableRedirect(request: Request, returnTo: unknown) {
  const redirect = NextResponse.redirect(new URL(connectUnavailablePath(returnTo), request.url), 303);
  redirect.headers.set("cache-control", "no-store");
  return redirect;
}

/**
 * Sucesso do connect continua 303 para o Mercado Pago. Configuração inválida
 * responde 503 JSON. Na navegação do formulário, o dono vai para a página do app,
 * sem o código técnico.
 */
export async function presentOwnerConnectResponse(request: Request, response: Response) {
  if (!browserNavigation(request) || response.status !== 503) return response;
  const payload = await response.clone().json().catch(() => null) as { error?: { code?: unknown } } | null;
  const code = typeof payload?.error?.code === "string" ? payload.error.code : null;
  if (!ownerConnectConfigCopy(code)) return response;
  return unavailableRedirect(request, await readReturnTo(request));
}

export async function respondMercadoPagoConnect(request: Request, run: () => Promise<Response>) {
  const navigation = request.clone();
  const response = await handleHttp(run);
  return presentOwnerConnectResponse(navigation, response);
}
