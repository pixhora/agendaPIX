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

/** Tira a URL, a senha e o usuário da mensagem. O texto que sobra não serve para reconectar. */
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
  for (const secret of [parsed.password, parsed.username]) {
    if (!secret) continue;
    text = text.split(secret).join("[redacted]");
    try {
      const decoded = decodeURIComponent(secret);
      if (decoded !== secret) text = text.split(decoded).join("[redacted]");
    } catch {
      // Senha com % solto não decodifica.
    }
  }
  return text;
}

export const databaseUrlSourceLabel = {
  env: "env",
  file: ".env.migrate",
  dotenv: ".env",
  prompt: "prompt",
};
