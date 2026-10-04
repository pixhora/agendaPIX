import { writeFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/shell", () => ({
  DashboardShell: ({ children }: { children: ReactNode }) => createElement("main", {}, children),
  Empty: ({ children }: { children: ReactNode }) => createElement("section", {}, children),
}));
vi.mock("@/lib/dashboard/session", () => ({ ownerContext: vi.fn(async () => ({
  owner: { id: "owner-test" }, businesses: [], business: { id: "business-test", name: "Studio QA" },
})) }));
vi.mock("@/lib/dashboard/data", () => ({ dashboardCustomers: vi.fn(async () => [
  { id: "customer-test", name: "Ana & QA", phone: "+5511999990000", email: null },
]) }));

import CustomersPage from "../../app/dashboard/(owner)/customers/page";
import { dashboardCustomers } from "@/lib/dashboard/data";

it("oferece WhatsApp com E.164 sem duplicar país, mensagem codificada e ligação preservada", async () => {
  const markup = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ businessId: "business-test" }) }));
  const link = markup.match(/href="(https:\/\/wa\.me\/[^\"]+)"/);
  expect(link).not.toBeNull();
  const url = new URL(link![1].replace(/&amp;/g, "&"));
  expect(url.pathname).toBe("/5511999990000");
  expect(url.searchParams.get("text")).toBe("Olá, Ana & QA! Aqui é Studio QA.");
  expect(markup).toContain('href="tel:+5511999990000"');
  expect(markup).toContain('rel="noopener noreferrer"');
  expect(dashboardCustomers).toHaveBeenCalledWith("owner-test", "business-test");
  if (process.env.QA_CUSTOMERS_HTML) writeFileSync(process.env.QA_CUSTOMERS_HTML, markup);
});
