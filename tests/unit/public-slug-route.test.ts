import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAliasCache } from "../../lib/business-profile/alias-cache";
import { SlugMoved } from "../../lib/business-profile/public-slug";
import { withPublicSlug } from "../../lib/business-profile/public-route";

const state = vi.hoisted(() => ({ mode: "down" as "down" | "alias" | "none" }));

vi.mock("../../db", () => ({
  getDb: () => ({
    select() {
      if (state.mode === "down") {
        const error = new Error('relation "business_slug_history" does not exist');
        (error as Error & { cause?: unknown }).cause = {
          code: "42P01",
          detail: "postgres://user:super-secret@db.internal/app",
        };
        throw error;
      }
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        limit: async () => (state.mode === "alias" ? [{ slug: "salao-novo" }] : []),
      };
      return chain;
    },
  }),
}));

describe("withPublicSlug", () => {
  beforeEach(() => {
    clearAliasCache();
    state.mode = "down";
  });

  it("keeps the public route when the alias table is missing", async () => {
    const request = new Request("https://agenda.example/api/public/salao/bookings");
    const run = vi.fn(async () => Response.json({ ok: true }, { status: 201 }));
    const response = await withPublicSlug(request, "salao", run);
    expect(run).toHaveBeenCalledOnce();
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBeNull();
    const body = await response.text();
    expect(body).toBe('{"ok":true}');
    expect(body).not.toContain("business_slug_history");
    expect(body).not.toContain("42P01");
    expect(body).not.toContain("super-secret");

    const again = await withPublicSlug(request, "salao", run);
    expect(again.status).toBe(201);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("still answers 308 when the alias lookup succeeds", async () => {
    state.mode = "alias";
    const run = vi.fn(async () => Response.json({ ok: true }));
    const response = await withPublicSlug(
      new Request("https://agenda.example/api/public/antiga/bookings?x=1"),
      "antiga",
      run,
    );
    expect(run).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/api/public/salao-novo/bookings?x=1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("turns a moved slug from the handler into 308", async () => {
    state.mode = "none";
    const response = await withPublicSlug(
      new Request("https://agenda.example/api/public/antiga/services"),
      "antiga",
      async () => {
        throw new SlugMoved("nova");
      },
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/api/public/nova/services");
  });

  it("does not hide a failure from the booking handler", async () => {
    state.mode = "none";
    const response = await withPublicSlug(
      new Request("https://agenda.example/api/public/salao/bookings"),
      "salao",
      async () => {
        const error = new Error('relation "business_slug_history" does not exist');
        (error as Error & { cause?: unknown }).cause = { detail: "postgres://user:super-secret@db.internal/app" };
        throw error;
      },
    );
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain("internal_error");
    expect(body).not.toContain("business_slug_history");
    expect(body).not.toContain("super-secret");
  });
});
