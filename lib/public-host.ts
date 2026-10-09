const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "0.0.0.0", "localhost"]);

/** Host público sem protocolo, a partir de `BETTER_AUTH_URL`. Em produção, loopback não aparece. */
export function publicLinkHost(raw: string | undefined, nodeEnv = process.env.NODE_ENV ?? "development"): string {
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (nodeEnv === "production" && LOOPBACK_HOSTS.has(hostname)) return "";
  const defaultPort = url.protocol === "https:" ? "443" : "80";
  const port = url.port && url.port !== defaultPort ? `:${url.port}` : "";
  return `${hostname}${port}`;
}
