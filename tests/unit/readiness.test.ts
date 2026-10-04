import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "../../app/api/ready/route";

const { query, verify } = vi.hoisted(() => ({ query: vi.fn(), verify: vi.fn() }));
vi.mock("../../db", () => ({ getDb: () => ({ $client: { query } }) }));
vi.mock("../../lib/email", () => ({ verifyEmailTransport: verify }));
beforeEach(() => {
  query.mockReset().mockResolvedValue({});
  verify.mockReset().mockResolvedValue(true);
});

it("checks database and SMTP without sending email", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ready" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(query).toHaveBeenCalledWith({ text: "SELECT 1", query_timeout: 3000 });
  expect(verify).toHaveBeenCalledOnce();
});

it.each(["database", "smtp"])("returns safe unavailable response on %s failure", async (dependency) => {
  (dependency === "database" ? query : verify).mockRejectedValue(new Error("PRIVATE_SECRET"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
