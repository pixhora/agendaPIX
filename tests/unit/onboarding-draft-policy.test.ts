import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { requestKeySchema } from "../../lib/bookings/validation";
import { onboardingDraftCookie } from "../../lib/onboarding/draft-cookie";
import { oneBusinessPerOwner } from "../../lib/onboarding/owner-policy";

it("aceita o UUID v4 gerado para o rascunho como chave de cadastro", () => {
  expect(requestKeySchema.parse(randomUUID())).toMatch(/^[0-9a-f-]{36}$/);
});

it("grava o cookie do rascunho com os atributos do contrato", () => {
  const id = randomUUID();
  const cookie = onboardingDraftCookie(id);
  expect(cookie).toContain(`onb_draft=${id}`);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Path=/");
  expect(cookie).toContain("Max-Age=604800");
});

it("só liga um negócio por dono com a string true", () => {
  expect(oneBusinessPerOwner({})).toBe(false);
  expect(oneBusinessPerOwner({ ONE_BUSINESS_PER_OWNER: "false" })).toBe(false);
  expect(oneBusinessPerOwner({ ONE_BUSINESS_PER_OWNER: "TRUE" })).toBe(false);
  expect(oneBusinessPerOwner({ ONE_BUSINESS_PER_OWNER: "true" })).toBe(true);
});
