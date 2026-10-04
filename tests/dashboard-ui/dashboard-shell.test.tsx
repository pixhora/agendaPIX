import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "../../components/dashboard/shell";

const businesses = [{ id: "business-a", name: "Studio de beleza e cuidados com um nome longo para testar no celular" }, { id: "business-b", name: "Barbearia" }];
describe("shell do painel", () => {
  it.each(["/dashboard", "/dashboard/services", "/dashboard/customers", "/dashboard/settings"])("expõe quatro destinos sem abrir menu: %s", (path) => {
    const markup = renderToStaticMarkup(<DashboardShell title="Agenda" description="Organize os horários do seu negócio." path={path} businesses={businesses} businessId="business-a"><section>Conteúdo do negócio</section></DashboardShell>);
    expect((markup.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
    expect((markup.match(/href="\/dashboard[^\"]*businessId=business-a"/g) ?? [])).toHaveLength(4);
    expect(markup).not.toContain("inert");
    expect(markup).not.toContain("aria-expanded");
    expect(markup).toContain('aria-label="Painel"');
    if (path === "/dashboard" && process.env.QA_SHELL_HTML) writeFileSync(process.env.QA_SHELL_HTML, markup);
  });
  it("negócio indisponível oferece recuperação sem exibir conteúdo", () => {
    const markup = renderToStaticMarkup(<DashboardShell title="Agenda" description="Seus horários" path="/dashboard" businesses={businesses}><p>Conteúdo privado</p></DashboardShell>);
    expect(markup).toContain("Abrir meu negócio");
    expect(markup).not.toContain("Conteúdo privado");
  });
});
