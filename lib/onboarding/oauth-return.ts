/** O que a volta do Mercado Pago pode guardar: o resultado, nunca o segredo da URL. */
export function mpCallbackSessionValue(mp: string | null, reason: string | null): string {
  return JSON.stringify({
    mp: mp === "connected" || mp === "error" ? mp : null,
    reason: typeof reason === "string" && /^[a-z_]{1,64}$/.test(reason) ? reason : null,
  });
}

/** Apaga `code` e `state` da query. O valor não é copiado para outro lugar. */
export function stripOAuthReturnParams(search: URLSearchParams) {
  search.delete("code");
  search.delete("state");
}

const OAUTH_QUERY = /([?&#])(code|state)=[^&#\s]*/gi;

/** Linha de log sem o code nem o state da URL de retorno. */
export function redactOAuthReturnLog(value: string): string {
  return value.replace(OAUTH_QUERY, "$1$2=[omitido]");
}
