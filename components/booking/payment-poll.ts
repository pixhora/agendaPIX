import { GENERIC_SUBMIT_MESSAGE } from "./booking-error";
import { PAYMENT_CHECK_TIMEOUT_MS } from "./payment-check";
import type { PixUiPhase } from "./pix-status";

/** Espera depois que a consulta anterior termina, antes da próxima. */
export const PAYMENT_POLL_GAP_MS = 4_000;

/** Teto da espera depois de erros seguidos. */
export const PAYMENT_POLL_BACKOFF_MAX_MS = 30_000;

/** Compatível com o nome antigo do intervalo. */
export const PAYMENT_POLL_INTERVAL_MS = PAYMENT_POLL_GAP_MS;

/** Acima deste valor, ou inválido, a espera cai no fallback. */
export const RATE_LIMIT_RETRY_MAX_MS = 120_000;

/** `Retry-After` ausente, inválido ou maior que 120s. */
export const RATE_LIMIT_FALLBACK_MS = 60_000;

export const RATE_LIMIT_ERROR_AFTER_MS = 60_000;

const rateLimitUntilByKey = new Map<string, number>();

/** Espera de 429 que sobrevive a um poller novo, no remount, no `start` e no `show`. */
export function persistedRateLimitUntil(key: string, now = Date.now()): number {
  const until = rateLimitUntilByKey.get(key) ?? 0;
  if (until <= now) {
    rateLimitUntilByKey.delete(key);
    return 0;
  }
  return until;
}

export function persistRateLimitUntil(key: string, until: number, now = Date.now()): void {
  if (until > now) rateLimitUntilByKey.set(key, until);
  else rateLimitUntilByKey.delete(key);
}

export function clearPersistedRateLimits(): void {
  rateLimitUntilByKey.clear();
}

/**
 * 429 devolve o `Retry-After` mesmo com corpo vazio ou que não seja JSON.
 * Fora de 429, devolve `undefined`.
 */
export function retryAfterFrom429(status: number, body: unknown, retryAfterHeader: string | null): string | null | undefined {
  if (status !== 429) return undefined;
  void body;
  return retryAfterHeader;
}

/** `Retry-After` em segundos ou em data HTTP. Data no passado espera 0. Acima de 120s, ou inválido, espera 60s. */
export function readRetryAfterMs(header: string | null | undefined, now = Date.now()): number {
  const parsed = parseRetryAfterMs(header, now);
  if (parsed == null || parsed > RATE_LIMIT_RETRY_MAX_MS) return RATE_LIMIT_FALLBACK_MS;
  return parsed;
}

function parseRetryAfterMs(header: string | null | undefined, now: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds * 1000;
  }
  const at = Date.parse(trimmed);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, at - now);
}

/** 4s, 8s, 16s… até cerca de 30s. A primeira falha espera o intervalo base. */
export function pollBackoffMs(streak: number, baseMs = PAYMENT_POLL_GAP_MS): number {
  const step = Math.max(0, streak - 1);
  const delay = baseMs * 2 ** step;
  return Math.min(PAYMENT_POLL_BACKOFF_MAX_MS, delay);
}

export function rateLimitHint(seconds: number): string {
  const wait = Math.max(1, Math.ceil(seconds));
  return `Aguarde ${wait} s para verificar de novo.`;
}

/** 429 rate_limited: espera o Retry-After e só mostra erro se passar de ~60s. */
export function rateLimitView(now: number, since: number | null, retryAfterHeader: string | null): {
  since: number;
  delayMs: number;
  showError: boolean;
  message: string | null;
} {
  const started = since ?? now;
  const showError = now - started >= RATE_LIMIT_ERROR_AFTER_MS;
  return {
    since: started,
    delayMs: readRetryAfterMs(retryAfterHeader, now),
    showError,
    message: showError ? GENERIC_SUBMIT_MESSAGE : null,
  };
}

export type StatusPollOutcome<T> =
  | { kind: "ok"; terminal: boolean; data: T }
  | { kind: "rate_limited"; retryAfterHeader: string | null }
  | { kind: "error"; aborted: boolean };

type Timer = { cancel: () => void };

export const PAYMENT_FAILURE_STREAK = 3;

/** Uma falha isolada fica muda. Três seguidas, ou 60s sem sucesso, mostram o erro. */
export function pollFailureView(now: number, since: number | null, streak: number): {
  since: number;
  streak: number;
  message: string | null;
} {
  const started = since ?? now;
  const next = streak + 1;
  const show = next >= PAYMENT_FAILURE_STREAK || now - started >= RATE_LIMIT_ERROR_AFTER_MS;
  return { since: started, streak: next, message: show ? GENERIC_SUBMIT_MESSAGE : null };
}

export function createStatusPoller<T>(options: {
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => Timer;
  gapMs?: number;
  abortMs?: number;
  rateLimitKey?: string;
  request: (signal: AbortSignal, source: "background" | "manual") => Promise<StatusPollOutcome<T>>;
  onFeedback?: (checking: boolean) => void;
  onRateLimited?: (view: { showError: boolean; message: string | null; until: number }) => void;
  onFailure?: (view: { message: string | null }) => void;
  onOk?: (data: T, source: "background" | "manual") => void;
}) {
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? ((fn, ms) => {
    const id = setTimeout(fn, ms);
    return { cancel: () => clearTimeout(id) };
  });
  const gapMs = options.gapMs ?? PAYMENT_POLL_GAP_MS;
  const abortMs = options.abortMs ?? PAYMENT_CHECK_TIMEOUT_MS;
  let inFlight = 0;
  let maxInFlight = 0;
  let generation = 0;
  let controller: AbortController | null = null;
  let timer: Timer | null = null;
  let hidden = false;
  let stopped = false;
  let rateSince: number | null = null;
  let rateLimitedUntil = options.rateLimitKey ? persistedRateLimitUntil(options.rateLimitKey, now()) : 0;

  function rememberRateLimit(until: number) {
    rateLimitedUntil = until;
    if (options.rateLimitKey) persistRateLimitUntil(options.rateLimitKey, until, now());
  }
  let failureSince: number | null = null;
  let failureStreak = 0;
  const starts: number[] = [];
  let requests = 0;

  function clearTimer() {
    timer?.cancel();
    timer = null;
  }

  function rateLimitWait(): number {
    return Math.max(0, rateLimitedUntil - now());
  }

  function arm(delay: number) {
    clearTimer();
    if (stopped || hidden) return;
    timer = schedule(() => {
      void run("background");
    }, delay);
  }

  function raced<TResult>(promise: Promise<TResult>, signal: AbortSignal): Promise<TResult> {
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });
  }

  async function run(source: "background" | "manual"): Promise<void> {
    if (stopped || (hidden && source !== "manual")) return;
    const wait = rateLimitWait();
    if (wait > 0) {
      arm(wait);
      return;
    }
    const mine = ++generation;
    controller?.abort();
    clearTimer();
    const local = new AbortController();
    controller = local;
    inFlight = 1;
    requests += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    starts.push(now());
    if (source === "manual") options.onFeedback?.(true);
    const timeout = setTimeout(() => local.abort(), abortMs);
    let outcome: StatusPollOutcome<T>;
    try {
      outcome = await raced(options.request(local.signal, source), local.signal);
    } catch (error) {
      const aborted = local.signal.aborted || (error instanceof Error && error.name === "AbortError");
      outcome = { kind: "error", aborted };
    } finally {
      clearTimeout(timeout);
      if (controller === local) {
        controller = null;
        inFlight = 0;
      }
      if (source === "manual" && mine === generation) options.onFeedback?.(false);
    }
    if (mine !== generation || stopped) return;
    if (hidden && source !== "manual") return;
    if (outcome.kind === "error") {
      if (outcome.aborted && hidden) return;
      const view = pollFailureView(now(), failureSince, failureStreak);
      failureSince = view.since;
      failureStreak = view.streak;
      options.onFailure?.(view);
      arm(pollBackoffMs(view.streak, gapMs));
      return;
    }
    if (outcome.kind === "rate_limited") {
      const view = rateLimitView(now(), rateSince, outcome.retryAfterHeader);
      rateSince = view.since;
      rememberRateLimit(now() + view.delayMs);
      options.onRateLimited?.({ ...view, until: rateLimitedUntil });
      arm(view.delayMs);
      return;
    }
    rateSince = null;
    rememberRateLimit(0);
    failureSince = null;
    failureStreak = 0;
    options.onOk?.(outcome.data, source);
    if (!outcome.terminal) arm(gapMs);
  }

  return {
    start() {
      return run("background");
    },
    manual() {
      return run("manual");
    },
    hide() {
      hidden = true;
      clearTimer();
      controller?.abort();
    },
    show() {
      if (stopped) return;
      hidden = false;
      return run("background");
    },
    stop() {
      stopped = true;
      clearTimer();
      controller?.abort();
    },
    stats() {
      return { inFlight, maxInFlight, starts: [...starts], requests, rateLimitedUntil };
    },
  };
}

const TERMINAL_PHASES = new Set<PixUiPhase>(["paid", "expired", "cancelled", "charge_failed", "refund_pending", "refunded"]);

/** Resultado que encerra a verificação: não vale gastar outro pedido em seguida. */
export function isTerminalPixPhase(phase: PixUiPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

/** Clique manual com uma consulta em andamento entra na fila em vez de ser ignorado. */
export function shouldQueueManualCheck(inFlight: boolean): boolean {
  return inFlight;
}

/** Depois da consulta em andamento, um clique enfileirado só dispara outro GET se o resultado não for terminal. */
export function shouldRunQueuedManualCheck(phase: PixUiPhase, queued: boolean): boolean {
  return queued && !isTerminalPixPhase(phase);
}

/** O intervalo de 4s para quando a aba está oculta. */
export function shouldPollWhileVisible(visibilityState: DocumentVisibilityState | "visible" | "hidden" | "prerender"): boolean {
  return visibilityState !== "hidden";
}
