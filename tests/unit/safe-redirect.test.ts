import { describe, expect, it } from "vitest";
import { loginErrorPath, safeNextPath } from "../../lib/safe-redirect";

describe("safeNextPath", () => {
  it("aceita caminhos relativos do próprio app", () => {
    expect(safeNextPath("/dashboard/services?businessId=abc")).toBe("/dashboard/services?businessId=abc");
    expect(safeNextPath("/onboarding/concluir")).toBe("/onboarding/concluir");
  });

  it.each([
    undefined, "", "dashboard", "https://evil.example/x", "//evil.example", "/\\evil.example",
    "/%0d%0aLocation:x".replace("%0d%0a", "\r\n"), "javascript:alert(1)", "/login", "/login?next=/x",
    "/dashboard/login", "/api/auth/sign-out", "/" + "a".repeat(600),
  ])("recusa %s e usa /dashboard", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });

  it("monta o destino de erro do link mágico", () => {
    expect(loginErrorPath("/dashboard")).toBe("/login");
    expect(loginErrorPath("/onboarding/concluir")).toBe("/login?next=%2Fonboarding%2Fconcluir");
    expect(loginErrorPath("https://evil.example")).toBe("/login");
  });
});
