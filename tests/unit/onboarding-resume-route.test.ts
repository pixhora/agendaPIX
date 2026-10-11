import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({
  getAuth: () => ({ api: { getSession: () => mocks.session() } }),
}));

vi.mock("../../lib/onboarding/resume", () => ({
  resumeOwnedBusiness: (ownerId: string) => mocks.resume(ownerId),
}));

import { GET } from "../../app/api/onboarding/resume/route";

const ownerBusiness = {
  businessId: "00000000-0000-4000-8000-0000000000a1",
  slug: "studio-ana",
  publicPath: "/studio-ana",
};

beforeEach(() => {
  mocks.session.mockReset();
  mocks.resume.mockReset();
});

it("recupera o cadastro só pela sessão e ignora id e slug na URL", async () => {
  mocks.session.mockResolvedValue({ user: { id: "owner-a", email: "ana@example.com" } });
  mocks.resume.mockResolvedValue(ownerBusiness);
  const response = await GET(new Request("http://127.0.0.1:3344/api/onboarding/resume?businessId=00000000-0000-4000-8000-0000000000bb&slug=evil"));
  expect(response.status).toBe(200);
  expect(mocks.resume).toHaveBeenCalledTimes(1);
  expect(mocks.resume).toHaveBeenCalledWith("owner-a");
  await expect(response.json()).resolves.toEqual(ownerBusiness);
});

it("sem sessão não consulta negócio e não ecoa a URL", async () => {
  mocks.session.mockResolvedValue(null);
  const response = await GET(new Request("http://127.0.0.1:3344/api/onboarding/resume?slug=evil&businessId=00000000-0000-4000-8000-0000000000bb"));
  expect(response.status).toBe(401);
  expect(mocks.resume).not.toHaveBeenCalled();
  const body = await response.text();
  expect(body).not.toContain("evil");
  expect(body).not.toContain("00000000-0000-4000-8000-0000000000bb");
});
