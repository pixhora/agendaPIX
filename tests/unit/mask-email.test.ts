import { expect, it } from "vitest";
import { maskEmail } from "../../lib/privacy/mask-email";

it("mostra dois caracteres, reticências e o domínio em minúsculas", () => {
  expect(maskEmail("ana.souza@gmail.com")).toBe("an••@gmail.com");
  expect(maskEmail("ab@x.com")).toBe("a••@x.com");
  expect(maskEmail("a@x.com")).toBe("a••@x.com");
  expect(maskEmail("ana.souza@GMAIL.COM")).toBe("an••@gmail.com");
});

it("recusa e-mail sem nome ou sem domínio", () => {
  expect(maskEmail("@x.com")).toBeNull();
  expect(maskEmail("ana@")).toBeNull();
  expect(maskEmail("")).toBeNull();
  expect(maskEmail(null)).toBeNull();
});
