/**
 * Deixa o `sslmode` explícito como `verify-full` quando a URL usa prefer, require ou verify-ca.
 *
 * Hoje o `pg` 8 já trata esses três modos como `verify-full` (certificado e nome do servidor verificados) e avisa
 * que, no `pg` 9, eles passam a ter a semântica do libpq: `require` só criptografa, sem verificar o certificado.
 * Reescrever aqui mantém exatamente o comportamento atual, tira o aviso e impede que uma atualização futura
 * enfraqueça a conexão sem ninguém notar. Quem quiser a semântica do libpq pede com `uselibpqcompat=true`.
 *
 * Só mexe no texto da query: não passa a URL por `URL`, para não reescrever usuário e senha.
 */
export function explicitSslMode(url: string): string {
  if (/[?&]uselibpqcompat=true(?=&|$)/i.test(url)) return url;
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i, "$1verify-full");
}
