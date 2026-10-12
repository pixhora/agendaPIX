import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdempotencyKey } from "../../lib/slot-link/idempotency";
import { randomUuid } from "../../lib/random-uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ZERO_UUID = "00000000-0000-4000-8000-000000000000";

function cryptoWithoutRandomUuid() {
  const source = globalThis.crypto;
  return {
    getRandomValues: (buffer: ArrayBufferView) => source.getRandomValues(buffer),
  };
}

describe("randomUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses crypto.randomUUID when the browser has it", () => {
    const source = globalThis.crypto;
    const randomUUID = vi.fn(() => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    vi.stubGlobal("crypto", {
      randomUUID,
      getRandomValues: (buffer: ArrayBufferView) => source.getRandomValues(buffer),
    });
    expect(randomUuid()).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("mints distinct v4 keys when randomUUID is missing", () => {
    vi.stubGlobal("crypto", cryptoWithoutRandomUuid());
    const first = randomUuid();
    const second = randomUuid();
    const fromSlotLink = createIdempotencyKey();
    for (const key of [first, second, fromSlotLink]) {
      expect(key).toMatch(V4);
      expect(key).not.toBe(ZERO_UUID);
    }
    expect(first).not.toBe(second);
    expect(fromSlotLink).not.toBe(first);
    expect(fromSlotLink).not.toBe(second);
  });

  it("does not keep the zero uuid when randomUUID itself returns it", () => {
    const source = globalThis.crypto;
    vi.stubGlobal("crypto", {
      randomUUID: () => ZERO_UUID,
      getRandomValues: (buffer: ArrayBufferView) => source.getRandomValues(buffer),
    });
    const key = randomUuid();
    expect(key).toMatch(V4);
    expect(key).not.toBe(ZERO_UUID);
  });

  it("throws when all eight attempts stay on the zero uuid", () => {
    let calls = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => ZERO_UUID,
      getRandomValues: (buffer: ArrayBufferView) => {
        calls += 1;
        new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength).fill(0);
        return buffer;
      },
    });
    expect(() => randomUuid()).toThrow(new Error("Could not mint a UUID"));
    expect(calls).toBe(8);
  });

  it("accepts a real value on the eighth attempt", () => {
    let calls = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: ArrayBufferView) => {
        calls += 1;
        const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        bytes.fill(0);
        if (calls === 8) bytes[0] = 0xab;
        return buffer;
      },
    });
    const key = randomUuid();
    expect(calls).toBe(8);
    expect(key).toMatch(V4);
    expect(key).not.toBe(ZERO_UUID);
    expect(key.startsWith("ab")).toBe(true);
  });
});
