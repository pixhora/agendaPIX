import { redactSlotLinkToken } from "./slot-link-token";

/** Respostas que carregam o token no path: sem cache e sem referrer. */
export function withSlotLinkPrivacy(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Se uma falha ecoar o path, o token sai antes de subir. */
export function redactSlotLinkError(error: unknown, token: string) {
  if (error instanceof Error && token && error.message.includes(token)) {
    error.message = redactSlotLinkToken(error.message);
  }
  return error;
}
