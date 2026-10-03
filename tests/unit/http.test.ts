import { expect, it } from "vitest";
import { handleHttp, HttpError, readBody } from "../../lib/http";

it("limita corpo HTTP e devolve erro sem dados internos", async () => {
  const response = await handleHttp(async () => {
    await readBody(new Request("http://localhost", { method: "POST", body: "x".repeat(16385) }));
    return Response.json({});
  });
  expect(response.status).toBe(413);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("preserva erro de negócio e esconde falha interna", async () => {
  const conflict = await handleHttp(async () => { throw new HttpError(409, "slot_unavailable", "Escolha outro horário."); });
  expect(conflict.status).toBe(409);
  const failure = await handleHttp(async () => { throw new Error("postgresql://segredo@servidor"); });
  expect(failure.status).toBe(500);
  expect(await failure.text()).not.toContain("segredo");
});
