import { NextRequest, type NextFetchEvent } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aliasTarget = vi.hoisted(() => vi.fn(async () => "nova" as string | null));

vi.mock("@/lib/business-profile/public-slug", async () => {
  const actual = await vi.importActual<typeof import("@/lib/business-profile/public-slug")>("@/lib/business-profile/public-slug");
  return { ...actual, aliasTarget };
});

import { clearAliasCache } from "../../lib/business-profile/alias-cache";
import { proxy } from "../../proxy";

const fetchEvent = { waitUntil() {} } as unknown as NextFetchEvent;

describe("proxy event", () => {
  beforeEach(() => {
    clearAliasCache();
    aliasTarget.mockReset();
    aliasTarget.mockResolvedValue("nova");
  });

  it("uses the default lookup when Next passes the fetch event", async () => {
    const response = await proxy(new NextRequest("https://agenda.example/antiga?ref=wa"), fetchEvent);
    expect(aliasTarget).toHaveBeenCalledTimes(1);
    expect(aliasTarget).toHaveBeenCalledWith("antiga");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://agenda.example/nova?ref=wa");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("uses a function in the event slot and skips the default lookup", async () => {
    const lookup = vi.fn(async () => "outra");
    const response = await proxy(
      new NextRequest("https://agenda.example/antiga?ref=wa"),
      lookup as unknown as NextFetchEvent,
    );
    expect(aliasTarget).not.toHaveBeenCalled();
    expect(lookup).toHaveBeenCalledOnce();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://agenda.example/outra?ref=wa");
  });
});
