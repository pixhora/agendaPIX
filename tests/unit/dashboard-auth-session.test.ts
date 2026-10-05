import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("../../lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession } }) }));

import { getOwnerSession } from "../../lib/dashboard/auth-session";
import { HttpError } from "../../lib/http";

describe("sessão do dono via Better Auth no mesmo app", () => {
  afterEach(() => { mocks.getSession.mockReset(); });

  it("repassa apenas os headers e valida a sessão localmente", async () => {
    const headers = new Headers({ cookie: "session=synthetic", host: "evil.example", authorization: "private" });
    mocks.getSession.mockResolvedValue({ user: { id: "owner-test", name: "Dona", email: "dona@example.com" } });
    expect(await getOwnerSession(headers)).toMatchObject({ user: { id: "owner-test" } });
    expect(mocks.getSession).toHaveBeenCalledWith({ headers });
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("sessão ausente redirecionável", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await getOwnerSession(new Headers({ cookie: "session=expired" }))).toBeNull();
  });

  it.each([
    new HttpError(503, "auth_unavailable", "privado"),
    { user: { id: "", name: "x", email: "y@z.com" } },
  ])("falha fechada e segura com resposta inválida", async (payload) => {
    if (payload instanceof HttpError) mocks.getSession.mockRejectedValue(payload);
    else mocks.getSession.mockResolvedValue(payload);
    await expect(getOwnerSession(new Headers({ cookie: "session=synthetic" }))).rejects.toThrow(
      "Não foi possível verificar seu acesso. Tente novamente.",
    );
  });

  it("erro interno não publica segredo nem equivale a sessão ausente", async () => {
    mocks.getSession.mockRejectedValue(new Error("secret-internal"));
    await expect(getOwnerSession(new Headers({ cookie: "session=synthetic" }))).rejects.toThrow(
      /^Não foi possível verificar seu acesso/,
    );
  });
});
