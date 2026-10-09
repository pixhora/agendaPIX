import { describe, expect, it, vi } from "vitest";
import { GENERIC_SUBMIT_MESSAGE } from "../../components/booking/booking-error";
import {
  PAYMENT_POLL_BACKOFF_MAX_MS,
  PAYMENT_POLL_GAP_MS,
  RATE_LIMIT_FALLBACK_MS,
  RATE_LIMIT_RETRY_MAX_MS,
  clearPersistedRateLimits,
  createStatusPoller,
  pollBackoffMs,
  pollFailureView,
  rateLimitHint,
  readRetryAfterMs,
  retryAfterFrom429,
  type StatusPollOutcome,
} from "../../components/booking/payment-poll";
import { PAYMENT_CHECK_TIMEOUT_MS } from "../../components/booking/payment-check";

function hangUntilAbort(signal: AbortSignal): Promise<StatusPollOutcome<number>> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ kind: "error", aborted: true });
      return;
    }
    signal.addEventListener("abort", () => resolve({ kind: "error", aborted: true }), { once: true });
  });
}

describe("consulta do Pix", () => {
  it("aborta perto de 10s e só então espera 4s para a próxima", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const poller = createStatusPoller<number>({
      abortMs: PAYMENT_CHECK_TIMEOUT_MS,
      request: (signal) => {
        signals.push(signal);
        return hangUntilAbort(signal);
      },
    });
    void poller.start();
    expect(signals).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(PAYMENT_CHECK_TIMEOUT_MS - 1);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_GAP_MS - 1);
    expect(signals).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals).toHaveLength(2);
    expect(poller.stats().maxInFlight).toBe(1);
    poller.stop();
    vi.useRealTimers();
  });

  it("o clique manual não espera a consulta que já está no ar", async () => {
    vi.useFakeTimers();
    const sources: string[] = [];
    const signals: AbortSignal[] = [];
    let feedback = false;
    const poller = createStatusPoller<number>({
      request: (signal, source) => {
        sources.push(source);
        signals.push(signal);
        return hangUntilAbort(signal);
      },
      onFeedback: (checking) => {
        feedback = checking;
      },
    });
    void poller.start();
    expect(feedback).toBe(false);
    void poller.manual();
    expect(signals[0]?.aborted).toBe(true);
    expect(sources).toEqual(["background", "manual"]);
    expect(feedback).toBe(true);
    poller.stop();
    vi.useRealTimers();
  });

  it("não fura a espera do 429 no clique, no start nem ao voltar a aba", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const poller = createStatusPoller<number>({
      request: async () => {
        calls += 1;
        if (calls === 1) return { kind: "rate_limited", retryAfterHeader: "10" };
        return { kind: "ok", terminal: true, data: 1 };
      },
    });
    void poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    expect(poller.stats().rateLimitedUntil).toBeGreaterThan(Date.now());
    void poller.manual();
    void poller.start();
    poller.hide();
    void poller.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    poller.stop();
    vi.useRealTimers();
  });

  it("respeita o Retry-After do 429", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const poller = createStatusPoller<number>({
      request: async () => {
        calls += 1;
        if (calls === 1) return { kind: "rate_limited", retryAfterHeader: "60" };
        return { kind: "ok", terminal: true, data: 1 };
      },
    });
    void poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
    poller.stop();
    vi.useRealTimers();
  });

  it("não mostra erro no primeiro timeout e mostra depois de três", () => {
    expect(pollFailureView(0, null, 0).message).toBeNull();
    const second = pollFailureView(1_000, 0, 1);
    expect(second.message).toBeNull();
    expect(pollFailureView(2_000, second.since, second.streak).message).toBe(GENERIC_SUBMIT_MESSAGE);
    expect(pollFailureView(60_000, 0, 0).message).toBe(GENERIC_SUBMIT_MESSAGE);
  });

  it("aumenta a espera a cada erro e volta ao intervalo base depois de um sucesso", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const poller = createStatusPoller<number>({
      request: async () => {
        calls += 1;
        if (calls === 4) return { kind: "ok", terminal: false, data: 1 };
        if (calls > 4) return { kind: "ok", terminal: true, data: 1 };
        return { kind: "error", aborted: false };
      },
    });
    void poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_GAP_MS);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_GAP_MS * 2);
    expect(calls).toBe(3);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_GAP_MS * 4);
    expect(calls).toBe(4);
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_GAP_MS);
    expect(calls).toBe(5);
    poller.stop();
    vi.useRealTimers();
  });

  it("limita a espera dos erros em cerca de 30s", () => {
    expect(pollBackoffMs(1)).toBe(PAYMENT_POLL_GAP_MS);
    expect(pollBackoffMs(2)).toBe(PAYMENT_POLL_GAP_MS * 2);
    expect(pollBackoffMs(3)).toBe(PAYMENT_POLL_GAP_MS * 4);
    expect(pollBackoffMs(4)).toBe(PAYMENT_POLL_BACKOFF_MAX_MS);
    expect(pollBackoffMs(8)).toBe(PAYMENT_POLL_BACKOFF_MAX_MS);
  });

  it("lê Retry-After em segundos e em data HTTP", () => {
    const now = Date.parse("2026-10-09T12:00:00.000Z");
    expect(readRetryAfterMs("60", now)).toBe(60_000);
    expect(readRetryAfterMs("0", now)).toBe(0);
    expect(readRetryAfterMs(null, now)).toBe(RATE_LIMIT_FALLBACK_MS);
    expect(readRetryAfterMs("não é data", now)).toBe(RATE_LIMIT_FALLBACK_MS);
    expect(readRetryAfterMs(new Date(now + 15_000).toUTCString(), now)).toBe(15_000);
    expect(readRetryAfterMs(new Date(now - 5_000).toUTCString(), now)).toBe(0);
    expect(readRetryAfterMs("120", now)).toBe(RATE_LIMIT_RETRY_MAX_MS);
    expect(readRetryAfterMs("121", now)).toBe(60_000);
    expect(readRetryAfterMs(new Date(now + 121_000).toUTCString(), now)).toBe(60_000);
    expect(readRetryAfterMs("", now)).toBe(60_000);
    expect(RATE_LIMIT_FALLBACK_MS).toBe(60_000);
    expect(rateLimitHint(10)).toBe("Aguarde 10 s para verificar de novo.");
  });

  it("um poller novo, o start e o show não perdem a espera do 429", async () => {
    vi.useFakeTimers();
    clearPersistedRateLimits();
    let calls = 0;
    const first = createStatusPoller<number>({
      rateLimitKey: "booking-hold",
      request: async () => {
        calls += 1;
        return { kind: "rate_limited", retryAfterHeader: "10" };
      },
    });
    void first.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    first.stop();

    const second = createStatusPoller<number>({
      rateLimitKey: "booking-hold",
      request: async () => {
        calls += 1;
        return { kind: "ok", terminal: true, data: 1 };
      },
    });
    void second.start();
    second.hide();
    void second.show();
    void second.manual();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    second.stop();
    clearPersistedRateLimits();
    vi.useRealTimers();
  });

  it("429 sem corpo rate_limited ainda devolve o Retry-After", () => {
    expect(retryAfterFrom429(429, null, "30")).toBe("30");
    expect(retryAfterFrom429(429, "", "30")).toBe("30");
    expect(retryAfterFrom429(429, "não é json", "15")).toBe("15");
    expect(retryAfterFrom429(429, { oops: true }, "15")).toBe("15");
    expect(retryAfterFrom429(429, { error: { code: "other", message: "x" } }, "8")).toBe("8");
    expect(retryAfterFrom429(500, null, "30")).toBeUndefined();
    expect(retryAfterFrom429(200, "", null)).toBeUndefined();
  });
});
