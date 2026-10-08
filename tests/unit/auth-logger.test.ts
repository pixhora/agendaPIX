import { afterEach, expect, it, vi } from "vitest";
import { getAuth } from "../../lib/auth";

afterEach(() => vi.restoreAllMocks());

it("não publica tokens, SQL ou dados pessoais recebidos pelo logger de autenticação", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://local:example@localhost/agenda");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const logger = getAuth().options.logger!;
    const sensitive = new Error("SQL token=private-token email=private@example.com");
    logger.log!("error", sensitive.message, sensitive, { token: "private-token" });
    logger.log!("warn", "private-token", sensitive);
    expect(error.mock.calls).toEqual([["[AgendaPix auth] Authentication operation failed"]]);
    expect(warn.mock.calls).toEqual([["[AgendaPix auth] Authentication warning"]]);
  } finally {
    vi.unstubAllEnvs();
  }
});
