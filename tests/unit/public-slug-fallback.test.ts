import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http";
import { SlugMoved } from "../../lib/business-profile/public-slug";
import { listPublicServices } from "../../lib/bookings/service";

// Catálogo sem o negócio: é o caminho que consulta o alias, usado pela página e pelas rotas.
vi.mock("../../lib/bookings/public-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/bookings/public-catalog")>()),
  loadPublicCatalog: async () => {
    throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  },
}));

vi.mock("../../db", () => ({ getDb: () => ({}) }));

function fakeDatabase(mode: "missing" | "alias" | "none") {
  return {
    select() {
      if (mode === "missing") {
        const error = new Error('relation "business_slug_history" does not exist');
        (error as Error & { cause?: unknown }).cause = { code: "42P01", detail: "postgres://user:super-secret@db.internal/app" };
        throw error;
      }
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        limit: async () => (mode === "alias" ? [{ slug: "salao-novo" }] : []),
      };
      return chain;
    },
  } as never;
}

describe("listPublicServices when the slug is not live", () => {
  it("answers 404 instead of 500 when the alias table is missing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = await listPublicServices("salao", fakeDatabase("missing")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as HttpError).code).toBe("business_not_found");
    expect(logged).toHaveBeenCalledWith("[alias] code=42P01");
    expect(logged.mock.calls.flat().join(" ")).not.toContain("super-secret");
    logged.mockRestore();
  });

  it("still moves the request to the new slug when the alias exists", async () => {
    const error = await listPublicServices("antiga", fakeDatabase("alias")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SlugMoved);
    expect((error as SlugMoved).slug).toBe("salao-novo");
  });

  it("keeps the 404 when there is no alias", async () => {
    const error = await listPublicServices("nao-existe", fakeDatabase("none")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
  });
});
