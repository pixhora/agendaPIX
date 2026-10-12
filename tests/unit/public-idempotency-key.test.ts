import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorBodySchema } from "../../lib/contracts/errors";
import { slotLinkErrorBodySchema } from "../../lib/contracts/slot-link";
import { BLOCKED_PUBLIC_IDEMPOTENCY_KEY, INVALID_IDEMPOTENCY_KEY_MESSAGE } from "../../lib/bookings/idempotency-key";
import { paySlotLink } from "../../lib/bookings/slot-link";
import { createBooking } from "../../lib/bookings/service";
import { handleHttp } from "../../lib/http";

const CONSTANT_KEY = "00000000-0000-4000-8000-000000000000";
const body = {
  serviceId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
  startsAt: "2030-01-01T12:00:00.000Z",
  customer: { name: "Ana", phone: "+5511999999999" },
};
const token = "A".repeat(43);

function untouchedDatabase() {
  return new Proxy({}, {
    get() {
      throw new Error("database was used");
    },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-test-secret-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());

describe("chave constante de reserva pública", () => {
  it("recusa a chave fixa com 400 invalid_idempotency_key e não lê o banco", async () => {
    expect(BLOCKED_PUBLIC_IDEMPOTENCY_KEY).toBe(CONSTANT_KEY);
    const response = await handleHttp(async () => {
      await createBooking("salao", body, CONSTANT_KEY, untouchedDatabase() as never);
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({
      error: { code: "invalid_idempotency_key", message: INVALID_IDEMPOTENCY_KEY_MESSAGE },
    });
    expect(apiErrorBodySchema.parse(payload).error.code).toBe("invalid_idempotency_key");
    await expect(createBooking("salao", body, CONSTANT_KEY.toUpperCase(), untouchedDatabase() as never)).rejects.toMatchObject({
      status: 400,
      code: "invalid_idempotency_key",
    });
  });

  it("uma chave v4 aleatória segue para o banco", async () => {
    const database = {
      select() {
        throw new Error("database-reached");
      },
    };
    const key = randomUUID();
    expect(key).not.toBe(CONSTANT_KEY);
    await expect(createBooking("salao", body, key, database as never)).rejects.toThrow("database-reached");
    await expect(createBooking("salao", body, "00000000-0000-4000-8000-000000000001", database as never)).rejects.toThrow("database-reached");
  });

  it("o pagamento do link de horário recusa a mesma chave e aceita um v4 aleatório", async () => {
    const response = await handleHttp(async () => {
      await paySlotLink("salao", token, {}, `  ${CONSTANT_KEY}  `, null, untouchedDatabase() as never);
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({
      error: { code: "invalid_idempotency_key", message: INVALID_IDEMPOTENCY_KEY_MESSAGE },
    });
    expect(slotLinkErrorBodySchema.parse(payload).error.code).toBe("invalid_idempotency_key");

    const database = {
      execute() {
        throw new Error("database-reached");
      },
    };
    await expect(paySlotLink("salao", token, {}, randomUUID(), null, database as never)).rejects.toThrow("database-reached");
  });
});
