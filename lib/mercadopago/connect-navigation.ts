import { isAutoRefundAck, MP_CONNECT_CONSENT_VERSION } from "../mercadopago/consent";
import {
  classifyConnectFailure,
  classifyConnectResult,
  exposedConnectError,
  isMpConnectFailureCode,
  logConnectFailure,
  MpConnectFailureCode,
} from "../mercadopago/connect-failure";
import { handleHttp, HttpError } from "../http";
import { sanitizeMpReturnTo } from "../mercadopago-oauth/return-to";
import { readSupportWhatsappNumber } from "../support-contact";

/** Mesma frase de `mp_oauth_unconfigured`. O dono não vê código nem nome de variável. */
export const MP_CONNECT_CONFIG_COPY = "A conexão com o Mercado Pago ainda não está configurada.";

export const MP_CONNECT_FAILURE_TITLE = "Não conseguimos abrir o Mercado Pago";
export const MP_CONNECT_FAILURE_BODY = "Seu cadastro está salvo. Tente de novo em alguns minutos. Se continuar, fale com a gente.";

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

function isConnectPost(request: Request) {
  if (request.method !== "POST") return false;
  try {
    return /^\/api\/businesses\/[^/]+\/mercadopago\/connect\/?$/.test(new URL(request.url).pathname);
  } catch {
    return false;
  }
}

function showsFailurePage(request: Request, response: Response) {
  return browserNavigation(request) && response.status >= 400 && response.status !== 401;
}

function backHref(returnTo: string) {
  const pathname = returnTo.split(/[?#]/)[0] ?? "";
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/") ? "/onboarding" : "/dashboard";
}

type ConnectFields = { returnTo?: unknown; autoRefundAck?: unknown; consentVersion?: unknown };

async function readConnectForm(request: Request): Promise<ConnectFields> {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      const body = await request.json() as ConnectFields | null;
      return body ?? {};
    }
    if (type.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await request.text());
      return {
        returnTo: params.get("returnTo") ?? undefined,
        autoRefundAck: params.get("autoRefundAck") ?? undefined,
        consentVersion: params.get("consentVersion") ?? undefined,
      };
    }
  } catch {
    return {};
  }
  return {};
}

async function readReturnTo(request: Request) {
  return (await readConnectForm(request)).returnTo;
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

/** Mesmo POST do formulário. O servidor continua conferindo Origin/Referer. */
function connectRetryAction(request: Request) {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
  const match = pathname.match(/^\/api\/businesses\/([^/]+)\/mercadopago\/connect$/);
  if (!match?.[1]) return null;
  try {
    const businessId = decodeURIComponent(match[1]);
    if (!businessId || businessId.includes("/") || businessId.includes("\\") || businessId.includes("\0")) return null;
    return `/api/businesses/${encodeURIComponent(businessId)}/mercadopago/connect`;
  } catch {
    return null;
  }
}

function supportWhatsappLink() {
  const number = readSupportWhatsappNumber();
  return number ? `https://wa.me/${number}` : null;
}

function listedCode(code: MpConnectFailureCode | null): MpConnectFailureCode {
  return code && isMpConnectFailureCode(code) ? code : MpConnectFailureCode.Unknown;
}

function configErrorPage(returnTo: unknown, copyText: string = MP_CONNECT_CONFIG_COPY, status = 503) {
  const href = escapeHtml(backHref(sanitizeMpReturnTo(returnTo)));
  const copy = escapeHtml(copyText);
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
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function connectFailurePage(input: {
  status: number;
  code: MpConnectFailureCode;
  action: string | null;
  returnTo: string;
  backHref: string;
  includeConsent: boolean;
  supportUrl: string | null;
}) {
  const code = escapeHtml(listedCode(input.code));
  const back = escapeHtml(input.backHref);
  const support = input.supportUrl ? `<a class="secondary" href="${escapeHtml(input.supportUrl)}" target="_blank" rel="noopener noreferrer">Suporte no WhatsApp</a>` : "";
  const consent = input.includeConsent
    ? `<input type="hidden" name="consentVersion" value="${escapeHtml(MP_CONNECT_CONSENT_VERSION)}">
  <input type="hidden" name="autoRefundAck" value="on">`
    : "";
  const retry = input.action
    ? `<form method="post" action="${escapeHtml(input.action)}">
  <input type="hidden" name="returnTo" value="${escapeHtml(input.returnTo)}">
  ${consent}
  <button type="submit">Tentar de novo</button>
</form>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(MP_CONNECT_FAILURE_TITLE)}</title>
<style>
  :root {
    color-scheme: light;
    --paper: #f6f5f2;
    --ink: #0b0b0c;
    --ink-hover: #26262a;
    --ink-foreground: #f6f5f2;
    --muted: #5b5b5f;
    --ring: #0b0b0c;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --paper: #0f0f10;
      --ink: #f6f5f2;
      --ink-hover: #e2e1dd;
      --ink-foreground: #0b0b0c;
      --muted: #a3a3a8;
      --ring: #3fd0be;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    background: var(--paper);
    color: var(--ink);
    font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif;
  }
  main { width: min(100%, 28rem); padding: 1.5rem; }
  h1 { margin: 0; font-size: 1.75rem; line-height: 1.2; letter-spacing: -0.02em; }
  .lead { margin: 0.75rem 0 0; max-width: 36rem; font-size: 1rem; line-height: 1.5; color: var(--muted); }
  form, .links { display: flex; flex-direction: column; align-items: stretch; gap: 0.25rem; margin-top: 1.5rem; }
  .links { margin-top: 0.25rem; }
  button, a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 1.25rem;
    font: inherit;
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
  }
  button {
    width: 100%;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: var(--ink-foreground);
    cursor: pointer;
  }
  button:hover { background: var(--ink-hover); }
  a.secondary { color: var(--ink); font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
  button:focus-visible, a:focus-visible { outline: 3px solid var(--ring); outline-offset: 3px; }
  .code { margin: 1.5rem 0 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
  }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(MP_CONNECT_FAILURE_TITLE)}</h1>
  <p class="lead">${escapeHtml(MP_CONNECT_FAILURE_BODY)}</p>
  ${retry}
  <div class="links">
    <a class="secondary" href="${back}">Voltar ao painel</a>
    ${support}
  </div>
  <p class="code">Código: ${code}</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: input.status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

async function connectFailureDocument(request: Request, status: number, code: MpConnectFailureCode | null) {
  const fields = await readConnectForm(request);
  const returnTo = sanitizeMpReturnTo(fields.returnTo);
  const includeConsent = isAutoRefundAck(fields.autoRefundAck) && fields.consentVersion === MP_CONNECT_CONSENT_VERSION;
  return connectFailurePage({
    status,
    code: listedCode(code),
    action: connectRetryAction(request),
    returnTo,
    backHref: backHref(returnTo),
    includeConsent,
    supportUrl: supportWhatsappLink(),
  });
}

/**
 * Sucesso do connect continua 303. Na navegação do formulário, falha antes do
 * redirect vira a página com código fixo. O callback mantém a página anterior.
 * 401 segue como JSON (sessão expirada tem tratamento próprio no cliente).
 */
export async function presentOwnerConnectResponse(
  request: Request,
  response: Response,
  failure: MpConnectFailureCode | null = null,
) {
  if (!showsFailurePage(request, response)) return response;
  if (isConnectPost(request)) return connectFailureDocument(request, response.status, failure);
  const payload = await response.clone().json().catch(() => null) as { error?: { code?: unknown } } | null;
  const code = typeof payload?.error?.code === "string" ? payload.error.code : null;
  if (response.status === 503 && ownerConnectConfigCopy(code)) {
    return configErrorPage(await readReturnTo(request));
  }
  return configErrorPage(await readReturnTo(request), "Não deu para conectar o Mercado Pago agora. Volte e tente de novo.", response.status);
}

export async function respondMercadoPagoConnect(request: Request, run: () => Promise<Response>) {
  const navigation = request.clone();
  const connectPost = isConnectPost(navigation);
  let failure: MpConnectFailureCode | null = null;
  let response: Response;
  try {
    response = await run();
  } catch (error) {
    const skipLog = error instanceof HttpError && error.status === 401;
    if (connectPost && !skipLog) {
      failure = classifyConnectFailure(error);
      logConnectFailure(failure, error);
    }
    const exposed = exposedConnectError(error);
    response = await handleHttp(async () => {
      throw exposed;
    });
  }
  if (connectPost && failure == null && response.status >= 400 && response.status !== 401) {
    const payload = await response.clone().json().catch(() => null);
    const mapped = classifyConnectResult(response.status, payload);
    if (mapped) {
      failure = mapped;
      logConnectFailure(mapped, payload);
    } else if (showsFailurePage(navigation, response)) {
      failure = MpConnectFailureCode.Unknown;
      logConnectFailure(failure, payload);
    }
  }
  return presentOwnerConnectResponse(navigation, response, failure);
}
