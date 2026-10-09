import { describe, expect, it, vi } from "vitest";
import { GENERIC_SUBMIT_MESSAGE } from "../../components/booking/booking-error";
import {
  PAYMENT_POLL_GAP_MS,
  createStatusPoller,
  pollFailureView,
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
});
