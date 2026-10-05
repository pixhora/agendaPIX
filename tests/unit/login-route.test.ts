import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
  session: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/dashboard/auth-session", () => ({ getOwnerSession: mocks.session }));

import DashboardLoginRedirect from "../../app/dashboard/login/page";
import LoginPage from "../../app/login/page";

type Node = { props?: Record<string, unknown> } | Node[] | string | null | undefined;
function findProps(node: Node, key: string): Record<string, unknown> | undefined {
  if (!node || typeof node === "string") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const found = findProps(child, key); if (found) return found; }
    return undefined;
  }
  if (node.props && key in node.props) return node.props;
  return findProps(node.props?.children as Node, key);
}

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.session.mockReset();
});

describe("/dashboard/login (legado)", () => {
  it("redireciona para o login único", async () => {
    await expect(DashboardLoginRedirect({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/login");
  });
  it("encaminha error e next", async () => {
    await expect(DashboardLoginRedirect({ searchParams: Promise.resolve({ error: "INVALID_TOKEN", next: "/dashboard/services", foo: "x" }) }))
      .rejects.toThrow("redirect:/login?error=INVALID_TOKEN&next=%2Fdashboard%2Fservices");
  });
});

describe("/login", () => {
  it("dono já autenticado vai direto ao destino validado", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u", name: "Dono", email: "dono@example.com" } });
    await expect(LoginPage({ searchParams: Promise.resolve({ next: "/dashboard/customers" }) })).rejects.toThrow("redirect:/dashboard/customers");
    await expect(LoginPage({ searchParams: Promise.resolve({ next: "https://evil.example" }) })).rejects.toThrow("redirect:/dashboard");
  });
  it("sem sessão (ou sessão indisponível) mostra o formulário", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    mocks.session.mockRejectedValue(new Error("db down"));
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("com erro de link não consulta sessão e mostra o aviso", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({ error: "INVALID_TOKEN" }) });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(findProps(element, "linkError")).toEqual({ callbackURL: "/dashboard", linkError: true });
  });
});
