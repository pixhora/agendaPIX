import { afterEach, expect, it, vi } from "vitest";
import { PROFILE_ERROR_COPY } from "../../lib/store-profile/api-copy";
import { patchBusinessProfile } from "../../lib/store-profile/profile-client";

const businessId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

afterEach(() => {
  vi.unstubAllGlobals();
});

function conflict(code: string, suggestions: string[]) {
  return new Response(JSON.stringify({
    error: {
      code,
      message: "ignorado",
      details: { constraint: "slug", suggestions },
    },
  }), { status: 409, headers: { "content-type": "application/json" } });
}

it("keeps slug_conflict_retry and the race copy with suggestions", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => conflict("slug_conflict_retry", ["loja-2", "loja-3"])));
  const result = await patchBusinessProfile(businessId, { slug: "loja-nova" });
  expect(result).toMatchObject({
    ok: false,
    status: 409,
    code: "slug_conflict_retry",
    message: PROFILE_ERROR_COPY.slug_conflict_retry,
    suggestions: ["loja-2", "loja-3"],
  });
  expect(PROFILE_ERROR_COPY.slug_conflict_retry).toBe(
    "Esse link acabou de ser escolhido por outra pessoa. Escolha uma das sugestões.",
  );
});

it("still maps another 409 to slug_taken", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => conflict("slug_taken", ["loja-2"])));
  const result = await patchBusinessProfile(businessId, { slug: "loja-nova" });
  expect(result).toMatchObject({
    ok: false,
    code: "slug_taken",
    message: PROFILE_ERROR_COPY.slug_taken,
    suggestions: ["loja-2"],
  });
});
