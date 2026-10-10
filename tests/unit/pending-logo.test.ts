import { afterEach, expect, it, vi } from "vitest";
import { LOGO_RELOAD_MESSAGE, clearPendingLogo, peekPendingLogo, rememberPendingLogo } from "../../lib/store-profile/pending-logo";

const memory = new Map<string, string>();

afterEach(() => {
  clearPendingLogo();
  memory.clear();
  vi.unstubAllGlobals();
});

it("keeps the logo file in memory and drops a stored base64 copy", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  });
  memory.set("agenda_onboarding_logo", JSON.stringify({
    name: "logo.png",
    type: "image/png",
    base64: "a".repeat(80),
  }));

  expect(LOGO_RELOAD_MESSAGE).toBe("A página recarregou e a logo não veio junto. Escolha o arquivo de novo.");
  expect(peekPendingLogo()).toBeNull();
  expect(memory.has("agenda_onboarding_logo")).toBe(false);

  const file = new File([Uint8Array.from([1, 2, 3])], "logo.png", { type: "image/png" });
  rememberPendingLogo(file);
  expect(peekPendingLogo()).toBe(file);
  expect(memory.size).toBe(0);

  clearPendingLogo();
  expect(peekPendingLogo()).toBeNull();
});
