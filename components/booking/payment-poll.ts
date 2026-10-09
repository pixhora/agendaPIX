import { GENERIC_SUBMIT_MESSAGE } from "./booking-error";
import { PAYMENT_CHECK_TIMEOUT_MS } from "./payment-check";
import type { PixUiPhase } from "./pix-status";

/** Espera depois que a consulta anterior termina, antes da próxima. */
export const PAYMENT_POLL_GAP_MS = 4_000;

/** Compatível com o nome antigo do intervalo. */
export const PAYMENT_POLL_INTERVAL_MS = PAYMENT_POLL_GAP_MS;

export const RATE_LIMIT_FALLBACK_MS = 10_000;

export const RATE_LIMIT_ERROR_AFTER_MS = 60_000;

export function readRetryAfterMs(header: string | null | undefined): number {
  if (!header) return RATE_LIMIT_FALLBACK_MS;
  const seconds = Number.parseInt(header.trim(), 10);
  if (!Number.isFinite(seconds) || seconds < 0) return RATE_LIMIT_FALLBACK_MS;
  return seconds * 1000;
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
    delayMs: readRetryAfterMs(retryAfterHeader),
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
  request: (signal: AbortSignal, source: "background" | "manual") => Promise<StatusPollOutcome<T>>;
  onFeedback?: (checking: boolean) => void;
  onRateLimited?: (view: { showError: boolean; message: string | null }) => void;
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
  let failureSince: number | null = null;
  let failureStreak = 0;
  const starts: number[] = [];
  let requests = 0;

  function clearTimer() {
    timer?.cancel();
    timer = null;
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
      arm(gapMs);
      return;
    }
    if (outcome.kind === "rate_limited") {
      const view = rateLimitView(now(), rateSince, outcome.retryAfterHeader);
      rateSince = view.since;
      options.onRateLimited?.(view);
      arm(view.delayMs);
      return;
    }
    rateSince = null;
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
      return { inFlight, maxInFlight, starts: [...starts], requests };
    },
  };
}

const TERMINAL_PHASES = new Set<PixUiPhase>(["paid", "expired", "cancelled", "refund_pending", "refunded"]);

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
