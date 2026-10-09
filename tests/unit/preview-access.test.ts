import { describe, expect, it } from "vitest";
import { isPreviewRouteOpen } from "@/lib/preview/access";

describe("preview access", () => {
  it("fecha as rotas /preview em produção", () => {
    expect(isPreviewRouteOpen("production")).toBe(false);
  });

  it("mantém as rotas /preview abertas fora de produção", () => {
    expect(isPreviewRouteOpen("development")).toBe(true);
    expect(isPreviewRouteOpen("test")).toBe(true);
  });
});
