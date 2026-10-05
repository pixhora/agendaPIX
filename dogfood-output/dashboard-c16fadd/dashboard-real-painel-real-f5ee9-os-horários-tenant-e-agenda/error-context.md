# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-real.spec.ts >> painel real: login SMTP, sessão, serviços, horários, tenant e agenda
- Location: tests/qa/dashboard-real.spec.ts:9:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('li').filter({ has: getByRole('heading', { name: 'Serviço QA integrado', exact: true }) }).getByRole('form').getByRole('alert')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('li').filter({ has: getByRole('heading', { name: 'Serviço QA integrado', exact: true }) }).getByRole('form').getByRole('alert') with timeout 8000ms
  - waiting for locator('li').filter({ has: getByRole('heading', { name: 'Serviço QA integrado', exact: true }) }).getByRole('form').getByRole('alert')

```

```yaml
- link "Ir para o conteúdo":
  - /url: "#content"
- banner:
  - paragraph: Seu painel Dono QA painel
  - button "Sair da conta"
- main:
  - heading "Serviços e preços" [level=1]
  - paragraph: Defina o que seus clientes podem agendar e o sinal de cada atendimento.
  - text: Negócio
  - combobox "Negócio":
    - option "Painel QA real"
    - option "Negócio QA E2E" [selected]
  - button "Abrir negócio"
  - navigation "Painel":
    - link "Agenda":
      - /url: /dashboard?businessId=7fe64498-ad42-4f3d-8acc-3f5991eaf011
    - link "Serviços":
      - /url: /dashboard/services?businessId=7fe64498-ad42-4f3d-8acc-3f5991eaf011
    - link "Clientes":
      - /url: /dashboard/customers?businessId=7fe64498-ad42-4f3d-8acc-3f5991eaf011
    - link "Funcionamento":
      - /url: /dashboard/settings?businessId=7fe64498-ad42-4f3d-8acc-3f5991eaf011
  - heading "Cadastrar serviço" [level=2]
  - form "Cadastrar serviço":
    - text: Nome do serviço
    - textbox "Nome do serviço"
    - text: Duração (minutos)
    - spinbutton "Duração (minutos)": "30"
    - text: Preço (R$)
    - textbox "Preço (R$)"
    - text: Sinal (R$)
    - textbox "Sinal (R$)": 0,00
    - paragraph: O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.
    - checkbox "Disponível para agendamento" [checked]
    - text: Disponível para agendamento
    - button "Cadastrar serviço"
  - heading "Seus serviços" [level=2]
  - list:
    - listitem:
      - heading "Tentativa tenant QA" [level=3]
      - paragraph: 45 minutos · Disponível
      - paragraph: R$ 85,90
      - paragraph: Sinal R$ 20,15
      - group:
        - text: Editar serviço
        - form "Editar Tentativa tenant QA":
          - text: Nome do serviço
          - textbox "Nome do serviço": Tentativa tenant QA
          - text: Duração (minutos)
          - spinbutton "Duração (minutos)": "45"
          - text: Preço (R$)
          - textbox "Preço (R$)": 85,90
          - text: Sinal (R$)
          - textbox "Sinal (R$)": "20.15"
          - paragraph: O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.
          - checkbox "Disponível para agendamento" [checked]
          - text: Disponível para agendamento
          - status: Serviço salvo.
          - button "Salvar serviço"
- alert
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto";
  2   | import { readFileSync, readdirSync, statSync } from "node:fs";
  3   | import { join } from "node:path";
  4   | import { Pool } from "pg";
  5   | import { expect, test } from "@playwright/test";
  6   | 
  7   | const evidenceDirectory = process.env.QA_DASHBOARD_FIXTURES ?? "/tmp/agenda-t2-final";
  8   | 
  9   | test("painel real: login SMTP, sessão, serviços, horários, tenant e agenda", async ({ page, context, baseURL }) => {
  10  |   const fixture = JSON.parse(readFileSync(join(evidenceDirectory, "fixture.json"), "utf8")) as { email: string; ownerId: string; businessId: string; date: string };
  11  |   const privateEnvironment = JSON.parse(readFileSync(join(evidenceDirectory, "env.json"), "utf8")) as { DATABASE_URL: string };
  12  |   const pool = new Pool({ connectionString: privateEnvironment.DATABASE_URL });
  13  |   const businessId = randomUUID(), foreignOwner = randomUUID(), foreignBusiness = randomUUID();
  14  |   let initialized = false;
  15  |   try {
  16  |     await page.goto("/dashboard");
  17  |     await expect(page).toHaveURL(/\/dashboard\/login/);
  18  |     const mailStart = Date.now();
  19  |     await page.getByLabel("Seu email").fill(fixture.email);
  20  |     await page.getByRole("button", { name: "Receber link de acesso" }).click();
  21  |     // Falha aqui comprova bloqueio no envio/autenticação; não contornar criando sessão.
  22  |     await expect(page.getByRole("status")).toContainText("Confira sua caixa de entrada");
  23  |     let magicLink = "";
  24  |     await expect.poll(() => {
  25  |       for (const name of readdirSync(evidenceDirectory).filter(name => /^email-.*\.eml$/.test(name))) {
  26  |         const path = join(evidenceDirectory, name);
  27  |         if (statSync(path).mtimeMs < mailStart) continue;
  28  |         const mail = readFileSync(path, "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
  29  |         const matches = mail.match(/https?:\/\/[^\s<>"']+\/api\/auth\/magic-link\/verify\?[^\s<>"']+/g);
  30  |         if (matches?.length) magicLink = matches[0];
  31  |       }
  32  |       return Boolean(magicLink);
  33  |     }, { message: "SMTP local entrega link mágico" }).toBe(true);
  34  |     const verification = await context.request.get(magicLink);
  35  |     expect(verification.status(), "link recebido pelo SMTP cria sessão").toBeLessThan(400);
  36  |     const replay = await context.request.get(magicLink, { maxRedirects: 0 });
  37  |     expect(replay.status(), "link consumido não reutilizável").toBeGreaterThanOrEqual(300);
  38  |     await page.goto(`/dashboard?businessId=${fixture.businessId}&date=${fixture.date}`);
  39  |     await expect(page.getByRole("heading", { name: /^Agenda de/ })).toBeVisible();
  40  |     await page.getByRole("link", { name: "Semana", exact: true }).click();
  41  |     await expect(page.getByRole("link", { name: "Semana", exact: true })).toHaveAttribute("aria-current", "page");
  42  |     await expect(page.locator("main section")).toHaveCount(7);
  43  |     await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1,$2,$3)', [foreignOwner, "Dono QA isolado", `${foreignOwner}@example.com`]);
  44  |     await pool.query("INSERT INTO businesses (id, owner_id, name, slug) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)", [businessId, fixture.ownerId, "Negócio QA E2E", `qa-${businessId}`, foreignBusiness, foreignOwner, "Negócio alheio QA", `qa-${foreignBusiness}`]);
  45  |     initialized = true;
  46  |     await page.goto(`/dashboard/services?businessId=${businessId}`);
  47  |     await expect(page.getByText("Seu primeiro serviço começa aqui")).toBeVisible();
  48  |     const form = page.getByRole("form", { name: "Cadastrar serviço", exact: true });
  49  |     await form.getByLabel("Nome do serviço").fill("Serviço QA integrado");
  50  |     await form.getByLabel("Duração (minutos)").fill("45");
  51  |     await form.getByLabel("Preço (R$)").fill("80,35");
  52  |     await form.getByLabel("Sinal (R$)").fill("90,00");
  53  |     await form.getByRole("button", { name: "Cadastrar serviço" }).click();
  54  |     await expect(form.getByRole("alert")).toBeVisible();
  55  |     await form.getByLabel("Sinal (R$)").fill("20,15");
  56  |     await form.getByRole("button", { name: "Cadastrar serviço" }).click();
  57  |     await expect(form.getByRole("status")).toHaveText("Serviço salvo.");
  58  |     const service = (await pool.query("SELECT id, price_cents, deposit_cents FROM services WHERE business_id=$1", [businessId])).rows[0];
  59  |     expect(service.price_cents).toBe(8035); expect(service.deposit_cents).toBe(2015);
  60  |     await page.reload();
  61  |     const row = page.locator("li").filter({ has: page.getByRole("heading", { name: "Serviço QA integrado", exact: true }) });
  62  |     await row.getByText("Editar serviço", { exact: true }).click();
  63  |     const edit = row.getByRole("form");
  64  |     await edit.getByLabel("Preço (R$)").fill("85,90");
  65  |     await edit.getByRole("button", { name: "Salvar serviço" }).click();
  66  |     await expect(edit.getByRole("status")).toHaveText("Serviço salvo.");
  67  |     expect((await pool.query("SELECT price_cents FROM services WHERE id=$1", [service.id])).rows[0].price_cents).toBe(8590);
  68  |     await edit.locator('input[name="businessId"]').evaluate((element, value) => { (element as HTMLInputElement).value = value; }, foreignBusiness);
  69  |     await edit.getByLabel("Nome do serviço").fill("Tentativa tenant QA");
  70  |     await edit.getByRole("button", { name: "Salvar serviço" }).click();
> 71  |     await expect(edit.getByRole("alert")).toBeVisible();
      |                                           ^ Error: expect(locator).toBeVisible() failed
  72  |     expect((await pool.query("SELECT name FROM services WHERE id=$1", [service.id])).rows[0].name).toBe("Serviço QA integrado");
  73  |     await page.goto(`/dashboard/services?businessId=${foreignBusiness}`);
  74  |     await expect(page.getByRole("heading", { name: "Negócio indisponível" })).toBeVisible();
  75  |     await expect(page.getByRole("form", { name: "Cadastrar serviço" })).toHaveCount(0);
  76  |     await page.goto(`/dashboard/settings?businessId=${businessId}`);
  77  |     const hours = page.getByRole("form", { name: "Horários de funcionamento" });
  78  |     const monday = hours.getByRole("group", { name: "Segunda-feira" });
  79  |     await monday.getByLabel("Aberto", { exact: true }).check();
  80  |     await monday.getByLabel("Abre às").fill("09:30");
  81  |     await monday.getByLabel("Fecha às").fill("17:30");
  82  |     await hours.getByRole("button", { name: "Salvar horários de funcionamento" }).click();
  83  |     await expect(hours.getByRole("status")).toHaveText("Horários de funcionamento salvos.");
  84  |     expect((await pool.query("SELECT weekday, opens_at, closes_at FROM business_hours WHERE business_id=$1", [businessId])).rows).toEqual([{ weekday: 1, opens_at: "09:30:00", closes_at: "17:30:00" }]);
  85  |     await page.reload();
  86  |     await expect(page.getByRole("group", { name: "Segunda-feira" }).getByLabel("Abre às")).toHaveValue("09:30");
  87  |     for (const width of [375, 1280]) {
  88  |       await page.setViewportSize({ width, height: 812 });
  89  |       for (const route of ["", "/services", "/customers", "/settings"]) {
  90  |         await page.goto(`/dashboard${route}?businessId=${businessId}`);
  91  |         expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} ${width}px sem overflow`).toBe(true);
  92  |       }
  93  |     }
  94  |     const anonymous = await context.browser()!.newContext({ baseURL });
  95  |     const noSession = await anonymous.newPage();
  96  |     await noSession.goto(`/dashboard/services?businessId=${businessId}`);
  97  |     await expect(noSession).toHaveURL(/\/dashboard\/login/);
  98  |     await anonymous.close();
  99  |   } finally {
  100 |     if (initialized) {
  101 |       await pool.query("DELETE FROM business_hours WHERE business_id=$1", [businessId]);
  102 |       await pool.query("DELETE FROM services WHERE business_id=$1", [businessId]);
  103 |       await pool.query("DELETE FROM businesses WHERE id = ANY($1::uuid[])", [[businessId, foreignBusiness]]);
  104 |     }
  105 |     await pool.query('DELETE FROM "user" WHERE id=$1', [foreignOwner]);
  106 |     await pool.end();
  107 |   }
  108 | });
  109 | 
```