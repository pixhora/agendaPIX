# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-pix.spec.ts >> interface pública agenda e confirma com API, banco e webhook reais
- Location: tests/e2e/booking-pix.spec.ts:91:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Pague o sinal por Pix' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Pague o sinal por Pix' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Pague o sinal por Pix' })
    - waiting for "http://127.0.0.1:3001/e2e-223c13ed-28d1-4e76-8591-7fdbe512995e" navigation to finish...
    - navigated to "http://127.0.0.1:3001/e2e-223c13ed-28d1-4e76-8591-7fdbe512995e"

```

```yaml
- alert
- main:
  - heading "Salão E2E" [level=1]
  - paragraph: Agendamento online seguro
  - navigation "Etapas do agendamento":
    - list:
      - listitem: 1 Serviço
      - listitem: 2 Horário
      - listitem: 3 Dados
      - listitem: 4 Pix
  - heading "Escolha o serviço" [level=2]
  - paragraph: Selecione o procedimento que você deseja agendar.
  - radiogroup "Serviços disponíveis":
    - 'radio "Corte ⏱ 30 min • Total: R$ 50,00 Sinal: R$ 10,00"':
      - heading "Corte" [level=3]
      - text: "⏱ 30 min • Total: R$ 50,00 Sinal: R$ 10,00"
  - button "Selecione um serviço" [disabled]
  - text: 🔒 Seus dados estão protegidos. Confirmação instantânea por Pix.
```

# Test source

```ts
  13  |       throw new Error("Configure DATABASE_URL e FAKE_WEBHOOK_SECRET em .env para executar os testes e2e.");
  14  |     }
  15  |     const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  16  |     const database = drizzle(pool, { schema });
  17  |     const ownerId = randomUUID();
  18  |     const businessId = randomUUID();
  19  |     const serviceId = randomUUID();
  20  |     const slug = `e2e-${businessId}`;
  21  |     const bodyHashes: string[] = [];
  22  |     try {
  23  |       await database.insert(schema.user).values({ id: ownerId, name: "Dono E2E", email: `${ownerId}@example.com` });
  24  |       await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Salão E2E", slug });
  25  |       await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  26  |       await database.insert(schema.businessHours).values(Array.from({ length: 7 }, (_, weekday) => ({ businessId, weekday, opensAt: "09:00:00", closesAt: "18:00:00" })));
  27  |       await runFixture({ slug, serviceId, database, businessId, bodyHashes });
  28  |     } finally {
  29  |       try {
  30  |         const payments = await database.select().from(schema.payments).where(eq(schema.payments.businessId, businessId));
  31  |         const externalIds = payments.flatMap((payment) => payment.externalId ? [payment.externalId] : []);
  32  |         if (externalIds.length) await database.delete(schema.paymentEvents).where(inArray(schema.paymentEvents.externalId, externalIds));
  33  |         if (bodyHashes.length) await database.delete(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, bodyHashes));
  34  |         await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  35  |         await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  36  |         await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  37  |         await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  38  |         await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  39  |         await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  40  |         await database.delete(schema.user).where(eq(schema.user.id, ownerId));
  41  |       } finally {
  42  |         await pool.end();
  43  |       }
  44  |     }
  45  |   },
  46  | });
  47  | 
  48  | 
  49  | async function reserve(request: APIRequestContext, business: Business) {
  50  |   const services = await request.get(`/api/public/${business.slug}/services`);
  51  |   expect(services.status()).toBe(200);
  52  |   expect((await services.json()).services).toEqual([expect.objectContaining({ id: business.serviceId, depositCents: 1000 })]);
  53  |   const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  54  |   const availability = await request.get(`/api/public/${business.slug}/availability`, { params: { serviceId: business.serviceId, date } });
  55  |   expect(availability.status()).toBe(200);
  56  |   const { slots } = await availability.json();
  57  |   expect(slots.length).toBeGreaterThan(0);
  58  |   const input = { serviceId: business.serviceId, startsAt: slots[0].startsAt, customer: { name: "Cliente E2E", phone: "+5511999999999" } };
  59  |   const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data: input });
  60  |   expect(response.status()).toBe(201);
  61  |   const booking = await response.json();
  62  |   expect(booking).toMatchObject({ status: "pending_payment", startsAt: input.startsAt, payment: { provider: "fake", status: "pending", amountCents: 1000 } });
  63  |   expect(booking.payment.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
  64  |   expect(booking.payment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  65  |   return { booking, input, date };
  66  | }
  67  | 
  68  | async function paymentStatus(request: APIRequestContext, slug: string, booking: { bookingId: string; accessToken: string }) {
  69  |   const response = await request.get(`/api/public/${slug}/bookings/${booking.bookingId}/payment`, { headers: { Authorization: `Bearer ${booking.accessToken}` } });
  70  |   expect(response.status()).toBe(200);
  71  |   return response.json();
  72  | }
  73  | 
  74  | function paidWebhook(externalId: string, business: Business, amountCents = 1000) {
  75  |   const body = JSON.stringify({ eventId: randomUUID(), type: "payment.paid", externalId, amountCents, paidAt: new Date().toISOString() });
  76  |   const timestamp = String(Math.floor(Date.now() / 1000));
  77  |   business.bodyHashes.push(createHash("sha256").update(body).digest("hex"));
  78  |   return { data: body, headers: { "Content-Type": "application/json", "X-Fake-Timestamp": timestamp,
  79  |     "X-Fake-Signature": createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest("hex") } };
  80  | }
  81  | 
  82  | test("agenda, paga sinal fake e confirma pelo HTTP", async ({ request, business }) => {
  83  |   const { booking } = await reserve(request, business);
  84  |   expect((await paymentStatus(request, business.slug, booking)).status).toBe("pending_payment");
  85  |   const response = await request.post("/api/webhooks/payments/fake", paidWebhook(booking.payment.externalId, business));
  86  |   expect(response.status()).toBe(200);
  87  |   expect(await response.json()).toMatchObject({ outcome: "processed" });
  88  |   expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "confirmed", payment: { status: "paid", amountCents: 1000, copyPaste: null, qrCodeDataUrl: null } });
  89  | });
  90  | 
  91  | test("interface pública agenda e confirma com API, banco e webhook reais", async ({ page, request, business }) => {
  92  |   test.skip(!process.env.QA_BOOKING_UI_URL, "Defina QA_BOOKING_UI_URL para a interface do Terminal 4.");
  93  |   // Ponte de QA entre branches: respostas vêm do backend real em 3103, sem dados mockados.
  94  |   await page.route("**/api/public/**", async (route) => {
  95  |     const source = route.request();
  96  |     const url = new URL(source.url());
  97  |     const sourceHeaders = source.headers();
  98  |     const headers = Object.fromEntries(["content-type", "idempotency-key", "authorization"].flatMap((name) => sourceHeaders[name] ? [[name, sourceHeaders[name]]] : []));
  99  |     const response = await request.fetch(`${url.pathname}${url.search}`, {
  100 |       method: source.method(), headers, data: source.postData() ?? undefined,
  101 |     });
  102 |     await route.fulfill({ response });
  103 |   });
  104 |   await page.goto(`${process.env.QA_BOOKING_UI_URL}/${business.slug}`);
  105 |   await page.getByRole("radio", { name: /Corte/ }).click();
  106 |   await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  107 |   await page.getByRole("button", { name: /^Amanhã/ }).click();
  108 |   await page.getByRole("radiogroup", { name: "Horários disponíveis", exact: true }).getByRole("radio").first().click();
  109 |   await page.getByRole("button", { name: "Preencher meus dados" }).click();
  110 |   await page.getByLabel("Nome completo").fill("Cliente UI E2E");
  111 |   await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  112 |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
> 113 |   await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  114 |   const [charge] = await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId));
  115 |   expect(charge.amountCents).toBe(1000);
  116 |   await page.waitForTimeout(4500);
  117 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).not.toBeVisible();
  118 |   const [pendingBooking] = await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId));
  119 |   expect(pendingBooking.status).toBe("pending_payment");
  120 |   const delivery = await request.post("/api/webhooks/payments/fake", paidWebhook(charge.externalId!, business));
  121 |   expect(delivery.status()).toBe(200);
  122 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 8000 });
  123 |   const [booking] = await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId));
  124 |   expect(booking.status).toBe("confirmed");
  125 | });
  126 | 
  127 | test("consulta pública rejeita token, ID e slug manipulados sem expor dados", async ({ request, business }) => {
  128 |   const { booking } = await reserve(request, business);
  129 |   for (const [slug, id, token] of [
  130 |     [business.slug, booking.bookingId, null],
  131 |     [business.slug, booking.bookingId, "invalid-token"],
  132 |     [business.slug, randomUUID(), booking.accessToken],
  133 |     [`other-${randomUUID()}`, booking.bookingId, booking.accessToken],
  134 |   ]) {
  135 |     const response = await request.get(`/api/public/${slug}/bookings/${id}/payment`, {
  136 |       headers: token ? { Authorization: `Bearer ${token}` } : {},
  137 |     });
  138 |     expect(response.status()).toBe(404);
  139 |     expect(await response.json()).toEqual({ error: { code: slug === business.slug ? "booking_not_found" : "business_not_found", message: expect.any(String) } });
  140 |     expect(response.headers()["cache-control"]).toBe("no-store");
  141 |   }
  142 | });
  143 | 
  144 | test("payload e webhook inválidos não alteram reserva ou valor do sinal", async ({ request, business }) => {
  145 |   const { booking, input } = await reserve(request, business);
  146 |   for (const data of [{ ...input, depositCents: 1 }, { ...input, serviceId: "invalid" }, { ...input, customer: { name: "", phone: "11999999999" } }]) {
  147 |     const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data });
  148 |     expect(response.status()).toBe(400);
  149 |   }
  150 |   const invalidSignature = paidWebhook(booking.payment.externalId, business);
  151 |   invalidSignature.headers["X-Fake-Signature"] = "0".repeat(64);
  152 |   expect((await request.post("/api/webhooks/payments/fake", invalidSignature)).status()).toBe(401);
  153 |   const wrongAmount = await request.post("/api/webhooks/payments/fake", paidWebhook(booking.payment.externalId, business, 999));
  154 |   expect(wrongAmount.status()).toBe(200);
  155 |   expect(await wrongAmount.json()).toMatchObject({ outcome: "rejected", reason: "amount_mismatch" });
  156 |   expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "pending_payment", payment: { status: "pending", amountCents: 1000 } });
  157 |   expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
  158 | });
  159 | 
  160 | test("horário ocupado retorna 409 sem criar segunda reserva ou cobrança", async ({ request, business }) => {
  161 |   const { booking, input, date } = await reserve(request, business);
  162 |   const response = await request.post(`/api/public/${business.slug}/bookings`, { headers: { "Idempotency-Key": randomUUID() }, data: { ...input, customer: { name: "Outro cliente", phone: "+5511888888888" } } });
  163 |   expect(response.status()).toBe(409);
  164 |   const availability = await request.get(`/api/public/${business.slug}/availability`, { params: { serviceId: business.serviceId, date } });
  165 |   expect(availability.status()).toBe(200);
  166 |   expect((await availability.json()).slots.some((slot: { startsAt: string }) => slot.startsAt === input.startsAt)).toBe(false);
  167 |   expect((await paymentStatus(request, business.slug, booking)).status).toBe("pending_payment");
  168 |   expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
  169 |   expect(await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId))).toHaveLength(1);
  170 | });
  171 | 
  172 | test("webhook repetido e novo evento do mesmo pagamento não duplicam efeitos", async ({ request, business }) => {
  173 |   const { booking } = await reserve(request, business);
  174 |   const delivery = paidWebhook(booking.payment.externalId, business);
  175 |   const first = await request.post("/api/webhooks/payments/fake", delivery);
  176 |   expect(first.status()).toBe(200);
  177 |   expect(await first.json()).toMatchObject({ outcome: "processed" });
  178 |   const before = await business.database.select().from(schema.payments).where(eq(schema.payments.id, booking.payment.id));
  179 |   for (const repeated of [delivery, paidWebhook(booking.payment.externalId, business)]) {
  180 |     const response = await request.post("/api/webhooks/payments/fake", repeated);
  181 |     expect(response.status()).toBe(200);
  182 |     expect(await response.json()).toMatchObject({ outcome: "duplicate" });
  183 |   }
  184 |   expect(await paymentStatus(request, business.slug, booking)).toMatchObject({ status: "confirmed", payment: { status: "paid" } });
  185 |   expect(await business.database.select().from(schema.payments).where(eq(schema.payments.id, booking.payment.id))).toEqual(before);
  186 |   expect(await business.database.select().from(schema.payments).where(eq(schema.payments.businessId, business.businessId))).toHaveLength(1);
  187 |   const events = await business.database.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.externalId, booking.payment.externalId));
  188 |   expect(events).toHaveLength(2);
  189 |   const deliveries = await business.database.select().from(schema.webhookDeliveries).where(inArray(schema.webhookDeliveries.bodyHash, business.bodyHashes));
  190 |   expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(["duplicate", "duplicate", "processed"]);
  191 |   expect(await business.database.select().from(schema.bookings).where(eq(schema.bookings.businessId, business.businessId))).toHaveLength(1);
  192 | });
  193 | 
```