/** Um bloco do prompt oculto. Enter no meio do bloco (colar URL + Enter) encerra na hora. */
export function consumeHiddenChunk(value, chunk) {
  let next = value;
  for (const char of String(chunk)) {
    if (char === "\u0003") return { value: next, done: false, abort: true };
    if (char === "\r" || char === "\n") return { value: next, done: true, abort: false };
    if (char === "\u007f" || char === "\b") {
      next = next.slice(0, -1);
      continue;
    }
    next += char;
  }
  return { value: next, done: false, abort: false };
}

/** Tira a URL inteira e a senha. O usuário do banco fica, para o nome da tabela continuar legível. */
export function redactDatabaseMessage(message, url) {
  let text = String(message);
  if (!url) return text;
  text = text.split(url).join("[DATABASE_URL]");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return text;
  }
  if (!parsed.password) return text;
  text = text.split(parsed.password).join("[redacted]");
  try {
    const decoded = decodeURIComponent(parsed.password);
    if (decoded !== parsed.password) text = text.split(decoded).join("[redacted]");
  } catch {
    // Senha com % solto não decodifica.
  }
  return text;
}

export function formatDatabaseClientError(error, url) {
  const message = error instanceof Error ? error.message : String(error);
  return `Falha ao aplicar migrations: ${redactDatabaseMessage(message, url)}\n`;
}

export const databaseUrlSourceLabel = {
  env: "env",
  file: ".env.migrate",
  dotenv: ".env",
  prompt: "prompt",
};
