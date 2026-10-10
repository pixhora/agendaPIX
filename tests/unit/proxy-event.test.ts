import { NextRequest, type NextFetchEvent } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { clearAliasCache } from "../../lib/business-profile/alias-cache";
import { proxy } from "../../proxy";

const aliasTarget = vi.fn<(slug: string) => Promise<string>>(async () => "nova");

vi.mock("../../lib/business-profile/public-slug", async () => {
  const actual = await vi.importActual<typeof import("../../lib/business-profile/public-slug")>("../../lib/business-profile/public-slug");
  return {
    ...actual,
    aliasTarget: (slug: string) => aliasTarget(slug),
  };
});

beforeEach(() => {
  clearAliasCache();
  aliasTarget.mockClear();
});

it("usa aliasTarget quando o Next manda o evento no segundo argumento", async () => {
  const event = { waitUntil() { return undefined; } } as unknown as NextFetchEvent;
  const response = await proxy(new NextRequest("https://agenda.example/antiga?ref=wa"), event);
  expect(aliasTarget).toHaveBeenCalledWith("antiga");
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://agenda.example/nova?ref=wa");
});

it("ainda aceita a busca injetada nos testes", async () => {
  const lookup = vi.fn(async () => "outra");
  const response = await proxy(new NextRequest("https://agenda.example/antiga?ref=wa"), lookup);
  expect(aliasTarget).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("https://agenda.example/outra?ref=wa");
});
