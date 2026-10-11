const ORIGIN_RECEIVED_LOG_LIMIT = 200;

export type AppAllowedOriginReport = {
  origins: string[];
  invalidCount: number;
  problems: string[];
};

function hostnameIsVercelApp(hostname: string): boolean {
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  return labels[labels.length - 2] === "vercel" && labels[labels.length - 1] === "app";
}

/** Par www/apex da origem canônica. `https://www.host` ↔ `https://host`. */
export function pairedHostOrigin(origin: string): string | null {
  const url = new URL(origin);
  const labels = url.hostname.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return null;
  if (labels[0] === "www") url.hostname = labels.slice(1).join(".");
  else url.hostname = ["www", ...labels].join(".");
  return url.origin;
}

function schemeLessVercelOrigin(item: string): string | null {
  try {
    const url = new URL(`https://${item}`);
    if (!hostnameIsVercelApp(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function pushUnique(target: string[], origin: string) {
  for (const current of target) {
    if (current === origin) return;
  }
  target.push(origin);
}

/**
 * Itens de `APP_ALLOWED_ORIGINS`. URL inválida sai da lista.
 * Com `production`, host `.vercel.app` e o que não for https também saem e viram `problems`.
 */
export function inspectAppAllowedOrigins(raw: string | undefined, production: boolean): AppAllowedOriginReport {
  const origins: string[] = [];
  const problems: string[] = [];
  let invalidCount = 0;
  if (!raw) return { origins, invalidCount, problems };
  for (const part of raw.split(",")) {
    const item = part.trim();
    if (item.length === 0) continue;
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      const vercelOrigin = schemeLessVercelOrigin(item);
      if (production && vercelOrigin) {
        problems.push(`"${vercelOrigin}" (host .vercel.app)`);
        continue;
      }
      invalidCount += 1;
      continue;
    }
    const reasons: string[] = [];
    if (url.protocol !== "https:") reasons.push("não é https");
    if (hostnameIsVercelApp(url.hostname)) reasons.push("host .vercel.app");
    if (production && reasons.length > 0) {
      problems.push(`"${url.origin}" (${reasons.join("; ")})`);
      continue;
    }
    pushUnique(origins, url.origin);
  }
  return { origins, invalidCount, problems };
}

export function configuredAppOrigins(env: Readonly<Record<string, string | undefined>>): string[] {
  return inspectAppAllowedOrigins(env.APP_ALLOWED_ORIGINS, env.VERCEL_ENV === "production").origins;
}

/** Boot e build. Item inválido só avisa, sem o valor. Em `VERCEL_ENV=production`, `.vercel.app` e não-https derrubam o processo. */
export function assertConfiguredAppOrigins(env: Readonly<Record<string, string | undefined>> = process.env) {
  const report = inspectAppAllowedOrigins(env.APP_ALLOWED_ORIGINS, env.VERCEL_ENV === "production");
  if (report.invalidCount === 1) console.warn("APP_ALLOWED_ORIGINS: 1 item inválido ignorado.");
  else if (report.invalidCount > 1) console.warn(`APP_ALLOWED_ORIGINS: ${report.invalidCount} itens inválidos ignorados.`);
  if (report.problems.length > 0) {
    throw new Error(`APP_ALLOWED_ORIGINS não é aceito com VERCEL_ENV=production: ${report.problems.join(", ")}.`);
  }
}

export function originEqualsAllowed(origin: string, allowed: readonly string[]): boolean {
  for (const candidate of allowed) {
    if (candidate === origin) return true;
  }
  return false;
}

const REJECTED_ORIGIN_WINDOW_MS = 60_000;
const REJECTED_ORIGIN_MAP_LIMIT = 100;

type RejectedOriginSample = { loggedAt: number; suppressed: number };

const rejectedOriginSamples = new Map<string, RejectedOriginSample>();

/** Só para teste. O processo real guarda a amostra até o limite do mapa. */
export function resetRejectedOriginLog() {
  rejectedOriginSamples.clear();
}

/**
 * No máximo um warn por origem distinta a cada 60s. A chave é o Origin truncado.
 * `suppressed` conta as recusas da mesma origem que não viraram log desde o aviso anterior.
 */
export function logRejectedAppOrigin(originReceived: string, allowedOrigins: readonly string[], now = Date.now()) {
  const key = originReceived.slice(0, ORIGIN_RECEIVED_LOG_LIMIT);
  const current = rejectedOriginSamples.get(key);
  if (current && now - current.loggedAt < REJECTED_ORIGIN_WINDOW_MS) {
    current.suppressed += 1;
    rejectedOriginSamples.delete(key);
    rejectedOriginSamples.set(key, current);
    return;
  }
  const suppressed = current?.suppressed ?? 0;
  if (current) rejectedOriginSamples.delete(key);
  while (rejectedOriginSamples.size >= REJECTED_ORIGIN_MAP_LIMIT) {
    const oldest = rejectedOriginSamples.keys().next().value;
    if (oldest === undefined) break;
    rejectedOriginSamples.delete(oldest);
  }
  rejectedOriginSamples.set(key, { loggedAt: now, suppressed: 0 });
  console.warn({
    event: "forbidden_origin",
    origin_received: key,
    allowed_origins: [...allowedOrigins],
    suppressed,
  });
}
