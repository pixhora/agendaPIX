# Contratos de agendamento e pagamento

## Escopo e estado

Esta versão inclui a base técnica e o fluxo público de reserva com Pix simulado.
Rotas implementadas e seus formatos estão documentados abaixo. Painel, interface pública e gateway real ainda dependem dos próximos trabalhos.

## Convenções

- Identificadores de domínio: UUID. Identificadores do Better Auth: texto gerado pela biblioteca.
- Dinheiro: inteiro em centavos de BRL, entre 0 e 2.147.483.647. Cobranças precisam ser maiores que zero.
- Datas de eventos: `timestamptz`, enviadas futuramente em ISO 8601 com fuso explícito.
- Horários de funcionamento: hora local do negócio. Fuso inicial: `America/Sao_Paulo`.
- `created_at` tem padrão no banco. `updated_at` é atualizado pelo Drizzle/Better Auth; SQL direto deve atualizar esse campo explicitamente.
- Campos públicos futuros usam camelCase; nomes físicos das colunas usam snake_case.

## Schema de domínio

Tabelas de domínio têm `id`, `created_at` e `updated_at`. Tabelas de auditoria têm `id` e `created_at`; cada entrega é um registro independente.

| Tabela | Campos principais | Regras |
| --- | --- | --- |
| `businesses` | `owner_id`, `name`, `slug`, `timezone` | Dono referencia `user`; slug único em minúsculas, números e hífens; nome não vazio. |
| `business_pix_keys` | `business_id`, `type`, `ciphertext`, `nonce`, `key_version`, `hint` | Uma chave por negócio; AES-256-GCM; chave mestra só em `PIX_KEY_ENCRYPTION_KEY`; nunca incluir ciphertext ou chave completa em resposta/log. |
| `services` | `business_id`, `name`, `duration_minutes`, `price_cents`, `deposit_cents`, `active` | Duração positiva; preço e sinal não negativos; sinal não supera preço. |
| `business_hours` | `business_id`, `weekday`, `opens_at`, `closes_at` | Domingo = 0; sábado = 6; um intervalo por dia; abertura anterior ao fechamento. Ausência do dia significa fechado. |
| `customers` | `business_id`, `name`, `phone`, `email` opcional | Telefone normalizado em E.164, único dentro do negócio; sem CPF ou endereço. |
| `bookings` | `business_id`, `service_id`, `customer_id`, `starts_at`, `ends_at`, `price_cents`, `deposit_cents`, `status`, `expires_at` opcional | Serviço e cliente do mesmo negócio; início anterior ao fim; preço e sinal são cópias do valor contratado, não mudam quando o serviço muda. Reserva pendente exige vencimento posterior à criação. |
| `payments` | `business_id`, `booking_id`, `provider`, `external_id` opcional, `idempotency_key`, `amount_cents`, `status`, `paid_at` opcional, `expires_at` | Agendamento do mesmo negócio; valor positivo; chave de idempotência única; identificador externo único por provedor; pagamento pago exige data de confirmação. |

Estados de agendamento: `pending_payment`, `confirmed`, `cancelled`, `expired`, `completed`.
Estados de pagamento: `pending`, `paid`, `expired`, `failed`, `refunded`.
Os enums limitam valores armazenados. O fluxo atual cria reservas, expira pendências e confirma por webhook; integração real e demais transições serão implementadas depois.
Sinal zero é permitido no serviço, mas não cria cobrança de valor zero.

## Autenticação e isolamento

Tabelas `user`, `session`, `account` e `verification` seguem Better Auth. Sessões e contas referenciam o usuário.
`account` tem identidade única por provedor e conta externa. `verification` guarda o hash do token de link mágico.

Cada query futura do painel deve validar a sessão e filtrar pelo negócio pertencente ao usuário autenticado.
`findOwnedBusiness` exige o identificador do negócio e o usuário obtido da sessão; retorna `null` para negócio alheio ou inexistente.
`ownerId` nunca deve vir de um formulário ou corpo HTTP.
Chaves estrangeiras compostas impedem relacionar um agendamento a serviço/cliente alheio ou um pagamento a agendamento alheio.
Essas chaves protegem referências; não substituem autorização de leitura. Rotas públicas expõem apenas serviços e horários; dados da reserva exigem token de acesso.
Os testes com Postgres exercitam a consulta por dono e as referências cruzadas entre negócios.

Exclusões de domínio usam `RESTRICT` para evitar perda silenciosa de histórico financeiro.
A exclusão de conta e a política de retenção LGPD ainda precisam de definição do humano; não há endpoint destrutivo nesta etapa.

## Rotas implementadas

| Método e rota | Comportamento |
| --- | --- |
| `GET /` | Página provisória do esqueleto. |
| `GET /api/health` | `200` com `{ "status": "ok" }`; saúde do processo HTTP, sem consultar dependências. |
| `GET/POST /api/auth/[...all]` | Handler do Better Auth. Validação de entrada e de origem feita pela biblioteca. |
| `POST /api/auth/sign-in/magic-link` | Recebe email e callback; envia link por SMTP configurado. |
| `GET /api/auth/magic-link/verify` | Consome link válido e cria sessão. |
| `GET /api/auth/get-session` | Sessão atual ou ausência de sessão. |
| `POST /api/auth/sign-out` | Encerra a sessão atual. |
| `GET /api/businesses/{businessId}/pix-key` | Exige sessão do dono. Retorna `{ configured, type, hint }`; nunca retorna chave nem ciphertext. |
| `PUT /api/businesses/{businessId}/pix-key` | Exige sessão do dono, origem da aplicação e JSON `{ type, value }`. Valida tipo/chave, cifra com AES-256-GCM e retorna `{ configured, type, hint }`. |
| `DELETE /api/businesses/{businessId}/pix-key` | Exige sessão do dono e origem da aplicação. Remove chave do negócio; resposta `{ configured: false, type: null, hint: null }`. |

A configuração é validada com Zod quando usada. Build não abre conexão ao banco nem exige segredos.
Solicitação de link com SMTP inválido falha; nunca simula envio nem revela link no terminal.
Falhas inesperadas de SMTP/adapter e `APIError` interno no handler de autenticação respondem `500` com `{ "code": "AUTHENTICATION_FAILED", "message": "Não foi possível concluir o acesso. Tente novamente." }`. O hook nativo `onAPIError` transforma erros inesperados antes do catch do Better Call; `onResponse` saneia também respostas 5xx produzidas diretamente por endpoints, preservando status/cookies e forçando JSON com `Cache-Control: no-store`. O console recebe apenas uma mensagem fixa, sem erro bruto, stack, SQL, token ou email. Erros esperados de autenticação conservam status e formato do Better Auth, incluindo validação, origem proibida e redirecionamentos. A verificação de origem fica explicitamente habilitada, inclusive nos testes.
Falha ao inicializar a configuração de auth/banco responde `503` no Route Handler com `{ "error": { "code": "auth_unavailable", "message": "O acesso está indisponível. Tente novamente mais tarde." } }` e `Cache-Control: no-store`; nenhum segredo/configuração é publicado.
As rotas de chave Pix respondem `404` para negócio inexistente ou alheio, `401` sem sessão, `403` para origem inválida, `400` para chave inválida e `503` quando a cifra não está configurada. `type` aceita `cpf`, `cnpj`, `email`, `phone` ou `evp`. A chave é normalizada e cifrada com AES-256-GCM antes de persistir; o `business_id` autentica o ciphertext. `hint` contém somente máscara. Configure `PIX_KEY_ENCRYPTION_KEY` com 32 bytes aleatórios em hexadecimal (`openssl rand -hex 32`) fora do repositório. `key_version` atual é 1; trocar a chave exige recriptografar os registros antes da troca. Não use a chave de exemplo em produção. Esta API não cria cobrança Pix nem confirma pagamento.

Um QR estático/copia-e-cola Pix contém a própria chave de recebimento, necessária para o pagador enviar o dinheiro. A chave não deve aparecer no catálogo público; gerá-la como cobrança não prova liquidação. Reserva só confirma por evento autenticado do provedor. Confirmação manual vs. provedor ainda aguarda decisão do humano.

## Rotas previstas

| Área | Rotas propostas | Responsável |
| --- | --- | --- |
| Página pública | `GET /[slug]` | Terminal 4 |
| Painel | `/dashboard`, `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings`; login único em `/login` (`/dashboard/login` redireciona) | mesmo app Next (antes Terminal 2) |
| Dados do painel | Server Components + Server Actions (`lib/dashboard/data.ts`, `app/dashboard/(owner)/actions.ts`) no mesmo app; reutiliza schema/migrations do backend | app único |

## Painel do dono — app único (veio de `feat/dashboard-v2`, consolidado em `feat/frontend-consolidation`)

Decisão do dono: um único app Next.js, sem backend separado. Em relação ao PR #1 (`feat/dashboard`):

- Todas as rotas `app/api` de auth, public, webhooks, onboarding e pix-key permanecem intactas.
- A sessão do dono é validada **no mesmo processo** via `getAuth().api.getSession` (Better Auth), sem chamada HTTP a outra origem.
- Leituras/gravações usam Drizzle com `findOwnedBusiness`; dono A não acessa dados do negócio B (páginas, actions e testes de isolamento).
- Login em `/login` (`requestMagicLink`, mesma origem) e logout via `authClient`; chave Pix continua em `/api/businesses/[businessId]/pix-key`.
- Base atual: `feat/backend`. Quando o PR de integração do backend entrar no master, esta branch será rebaseada.

### Leituras e sessão

- `/dashboard`: agenda do dia ou semana (`businessId`, `date=YYYY-MM-DD`, `view=week`).
- `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings`: serviços, clientes e funcionamento.
- `requireOwner()` usa Better Auth local; sem sessão redireciona para `/login` (login único do app).
- `ownerContext()` lista só negócios do dono; negócio alheio aparece como indisponível.

### Gravações

| Ação | Comportamento |
| --- | --- |
| `saveService` | Cria/atualiza serviço do negócio autorizado; Zod + centavos no servidor. |
| `saveHours` | Substitui horários em transação com lock do negócio. |

Queries de disponibilidade não revelam dados pessoais. A criação de reserva impede concorrência de horários no banco.
O webhook fake valida assinatura, registra entregas e confirma de forma idempotente.
O gateway real deverá implementar `PaymentProvider`; nenhuma cobrança bancária real ocorre nesta versão.

## Aplicação e reversão

Não existiam tabelas, leitores, escritores ou dados de aplicação antes desta migration. Os escritores são Better Auth, as rotas de reserva e o webhook autenticado.

Caminho adiante: iniciar Postgres com `pnpm db:up`, aplicar `pnpm db:migrate`, iniciar aplicação e executar `pnpm test:db`.
Repetir `db:migrate` não recria tabelas nem reaplica migrations registradas. Falhas SQL são observáveis e a migration usa transação.
Em mudanças futuras com versões simultâneas, adicionar campos compatíveis antes de mudar leitores/escritores; nenhuma contração destrutiva está autorizada nesta tarefa.

Reversão segura: voltar ao código anterior e parar os serviços com `pnpm db:down`, mantendo o volume e as tabelas.
Não há script automático de DROP ou remoção de volume. Após entrada de dados reais, fazer backup e definir reversão específica antes de alterar o schema.


# Fluxo de reserva e Pix simulado

## Regras desta etapa

O servidor é a autoridade sobre preço, sinal e duração; o cliente envia somente serviço, horário e dados mínimos.
A reserva com sinal vence em `BOOKING_HOLD_MINUTES` (padrão 30, faixa 30–43200). O horário só aparece se começar depois desse prazo. Sinal zero confirma sem criar pagamento. O `expiresAt` público é esse hold, igual na reserva e no Pix. O Mercado Pago recebe `date_of_expiration` = hold + 2 minutos.
Um negócio atende um cliente por vez. Intervalos são semiabertos: um horário pode começar exatamente quando o anterior termina.
Disponibilidade usa o fuso do negócio e o intervalo de funcionamento do dia. Inícios avançam pela duração do serviço desde a abertura.
Reservas pendentes vencidas não ocupam disponibilidade. Ao criar nova reserva, elas são marcadas como expiradas antes da disputa pelo horário.
Concorrência é protegida por lock transacional do negócio e restrição de exclusão no Postgres. Não há confirmação após liberar uma reserva vencida.

## Rotas públicas

- `GET /api/public/config`: `{ holdMinutes, pixRecipientDisplayName: null, requiresPayerCpf }` com `Cache-Control: public, max-age=300`. `holdMinutes` é `BOOKING_HOLD_MINUTES`.
- `GET /api/public/[slug]/services`: nome, fuso, `pixRecipientDisplayName` (nome do dono, ou o nome do negócio se o do dono estiver vazio) e serviços ativos com `id`, `name`, `durationMinutes`, `priceCents`, `depositCents`.
- `GET /api/public/[slug]/availability?serviceId=<uuid>&date=YYYY-MM-DD`: responde `{ timezone, slots: [{ startsAt, endsAt }] }`. Datas de horários são ISO 8601 UTC. Lista vazia significa fechado, passado ou sem vagas.
- `POST /api/public/[slug]/bookings`: exige header `Idempotency-Key` UUID v4 e JSON `{ serviceId, startsAt, customer: { name, phone } }`. Telefone em E.164. Responde `201` com `{ bookingId, status, startsAt, endsAt, expiresAt, accessToken, payment }`; repetição idêntica responde `200`. Mesma chave com outro corpo responde `409`.
- `GET /api/public/[slug]/bookings/[id]/payment`: exige `Authorization: Bearer <accessToken>`. Responde `{ bookingId, status, expiresAt, payment }`. Não retorna nome, telefone nem dados do dono.

`payment` é `null` com sinal zero; caso contrário contém `{ id, provider, externalId, amountCents, status, expiresAt, qrCodeDataUrl, copyPaste }`.
O token de acesso é derivado com HMAC e contexto próprio usando o segredo do servidor; só seu hash é armazenado. UUID da reserva não autoriza leitura.
A chave de idempotência permite recuperar a resposta com o mesmo corpo e deve ser tratada como credencial: gerar com `crypto.randomUUID()`, não registrar em analytics e não reutilizar em outro pedido.
Repetições não renovam vencimento nem criam segunda cobrança. Campos extras, preço fornecido pelo cliente e datas sem fuso são rejeitados.
Respostas de domínio usam `Cache-Control: no-store`.

Erros: `{ error: { code, message } }`, sem detalhes pessoais ou internos. `400` entrada inválida; `404` negócio/serviço/reserva inacessível; `409` horário ocupado, chave reutilizada ou `hold_capacity_reached`; `413` corpo acima de 16 KiB; `429` `rate_limited` ou `pending_hold_limit`; `503` pagamento ou agendamento indisponível; `500` falha interna. `429` e `hold_capacity_reached` trazem `Retry-After` em segundos.

### Limite de reservas pendentes

Reservas com sinal não pago e não vencido (`pending_payment` com `expiresAt` futuro) são limitadas por negócio, sob o lock transacional do negócio e após marcar vencidas, então a contagem é exata sob concorrência:

- por cliente (`BOOKING_MAX_PENDING_PER_CLIENT`, padrão 3): identidade da seção Antiabuso, guardada em `bookings.client_hash` como HMAC por negócio, nunca o IP. Sem identidade, este limite não se aplica; `429 pending_hold_limit`.
- por telefone (`BOOKING_MAX_PENDING_PER_PHONE`, padrão 2): `429 pending_hold_limit`.
- por negócio (`BOOKING_MAX_PENDING_PER_BUSINESS`, padrão 50): `409 hold_capacity_reached`.

`Retry-After` aponta o vencimento mais próximo entre as reservas que causaram o limite. Replay idempotente de reserva existente não é bloqueado; reservas confirmadas, vencidas e de sinal zero não contam.

## PaymentProvider e fake

`PaymentProvider.createPixCharge` recebe chave de idempotência, centavos e vencimento; retorna identificador externo, centavos, vencimento, QR Code e copia-e-cola.
O provider deve criar no máximo uma cobrança por chave e repetir a resposta após falhas transitórias. Valores retornados são validados antes de persistir.
`PaymentProvider.verifyWebhook` autentica o corpo bruto e normaliza o evento. O domínio não interpreta protocolo do gateway.
Somente fake existe nesta etapa. Exige `PAYMENT_PROVIDER=fake`, segredo `FAKE_WEBHOOK_SECRET` exclusivo com ao menos 32 caracteres e ambiente diferente de produção.
QR Code PNG codifica texto prefixado `FAKE-PIX-NOT-PAYABLE`, não é um Pix bancário. A dependência `qrcode` é necessária para gerar QR Code padrão, sem implementar algoritmo próprio.
A reserva e o pagamento `creating` (só idempotencyKey/valor/vencimento) ocorrem numa transação curta com lock do negócio; `createPixCharge` roda **fora** de qualquer transação com timeout (`PAYMENT_PROVIDER_TIMEOUT_MS`) e `reference` = id do pagamento. Uma segunda transação curta anexa QR/`externalId` e promove a `pending` somente se ainda `creating`. Falha/timeout → `503` retriável; replay retoma. `expirePending` também expira `creating`. Interface do provider inclui `getCharge`/`findChargeByReference`/`cancelCharge`; `verifyWebhook` pode ser async (pronto para Mercado Pago).

## Webhook

`POST /api/webhooks/payments/fake` recebe JSON estrito:

```json
{
  "eventId": "evento-unico-do-provider",
  "type": "payment.paid",
  "externalId": "fake_uuid-da-cobranca",
  "amountCents": 1000,
  "paidAt": "2026-10-02T15:00:00.000Z"
}
```

Headers: `X-Fake-Timestamp` em segundos Unix e `X-Fake-Signature` em hexadecimal minúsculo.
Assinatura: HMAC-SHA256 de `<timestamp>.<corpo bruto>`, usando `FAKE_WEBHOOK_SECRET`. Comparação constante; tolerância de relógio de cinco minutos.
Assinatura inválida ou vencida responde `401`. JSON ou evento inválido responde `400`. Não há rota pública de simulação de pagamento.

Provedor, tamanho (Content-Length e leitura limitada a 16 KiB), assinatura e formato são verificados antes de qualquer acesso ao banco: provedor desconhecido `404`, corpo grande `413`, assinatura inválida `401`, evento inválido `400`, sem nenhuma escrita. Somente entregas verificadas geram linha em `webhook_deliveries`, única por `(provider, event_id)` e gravada na mesma transação do processamento: replay é no-op (responde `duplicate` sem novas linhas) e falha de processamento reverte tudo (`503`, o provedor reenvia). Guarda provider, identificador, hash do corpo, resultado e motivo; nunca guarda assinatura ou corpo bruto. A migration 0007 move entregas antigas não verificadas ou duplicadas para `webhook_deliveries_legacy` (arquivo de auditoria, sem exclusão). Rejeições não auditadas no banco devem ser observadas por logs/métricas do proxy.
Migration 0007 não é puramente expansiva: torna `event_id`/`body_hash` obrigatórios e únicos em `webhook_deliveries`, que o código anterior não respeita (gravava antes de validar). Aplicar junto com este código. Reversão: voltar ao código anterior e executar `ALTER TABLE webhook_deliveries DROP CONSTRAINT webhook_deliveries_provider_event_unique, ALTER COLUMN event_id DROP NOT NULL, ALTER COLUMN body_hash DROP NOT NULL;` As colunas/índices novos de `bookings` e a tabela legacy podem permanecer; nunca apagar `webhook_deliveries_legacy`, reservas ou pagamentos ao reverter.
`payment_events` tem identidade única por provider e evento, hash do evento normalizado, identificador da cobrança e resultado. Evento já visto com mesmo conteúdo é duplicado; conteúdo diferente com mesmo identificador responde `409`.
Deduplicação, alteração do pagamento, confirmação da reserva e resultado do evento ocorrem na mesma transação.
O efeito de pagamento confirmado vive em `applyPaidEvent` (webhook e reconciliação). Pagamento tardio com horário livre e política `rebook_if_free` confirma (`late_rebooked`). Sem horário livre, a única devolução automática sai depois do commit (`late_no_slot`): estorno total, `refundStatus` `in_process` ou `refunded` ou `failed`. O dono devolve pelo `GET/POST /api/businesses/[businessId]/bookings/[bookingId]/refund`. A listagem (`dashboardBookings`) e o detalhe (`dashboardBookingDetail`) expõem `refundStatus` (`null | in_process | refunded | failed`) e `refundedAt` (ISO-8601 ou null), separados do status da reserva. `GET` da devolução responde `200` com `{ eligible, reason, amountCents, customer: { name, emailMasked }, policy: { text, refundDeadlineAt }, paidAt }` e `Cache-Control: no-store`. `reason` é `null` ou `not_paid | already_refunded | refund_in_process | refund_window_expired | mp_account_not_connected`. O prazo de 180 dias conta da aprovação. `policy` lê o snapshot da reserva se as colunas existirem; senão vem null. `POST` com `{ confirm: true, expectedAmountCents }` devolve `{ status: "refunded" | "in_process", refundId }` ou `409`/`502 { error: { code } }`.

Reconciliador (`pnpm reconcile`): retoma `creating` preso (`RECONCILE_STUCK_SECONDS`), cancela no gateway `pending`/`expired` com `externalId`, consulta `pending` vigentes por webhooks perdidos. Advisory lock de sessão evita trabalho duplicado. Auditoria em `payment_audit` (sem PII).

Migrations 0008 (ADD VALUE do enum, commit isolado) e 0009 (tabela `payment_audit`, `late_payment_policy`, checks de `creating`/`pending`, unique `(business_id,id)` em payments). Reversão 0009: dropar checks/índices/`payment_audit`/`late_payment_policy` e o unique novo; valores de enum (`creating`,`cancelled`,`refund_pending`) são irreversíveis no Postgres — o código antigo simplesmente não os grava. Nunca apagar pagamentos/reservas/audit ao reverter.

Somente cobrança identificada pelo provider e identificador externo pode ser alterada. Valor deve corresponder à cobrança e ao sinal contratado.
Pagamento válido recebido a tempo confirma somente reserva pendente ainda válida. Pagamento tardio registra o dinheiro. Com horário livre e `rebook_if_free`, vira `late_rebooked`. Sem horário, o estorno automático roda fora da transação. Nenhum outro caminho chama o estorno. Não há repasse neste fluxo.
Evento de valor divergente é `rejected`, sem alterar cobrança ou reserva. Pagamento já pago é `duplicate`. Cobrança desconhecida é `ignored`.
Eventos autenticados processados respondem `200` com `{ outcome, reason }`, permitindo ao provider parar tentativas sem repetir efeitos.
Falha de infraestrutura responde `503` e mantém entrega marcada como falha quando o banco estiver acessível; o provider deve tentar novamente. Sem banco disponível não é possível persistir auditoria.

## Migration e compatibilidade

Campos novos em reservas e cobranças são opcionais no banco para preservar dados e testes antigos; endpoints novos só criam registros completos.
Tabelas de eventos são aditivas. A extensão `btree_gist` e a exclusão de horários entram em migration separada. Ela falha atomicamente se houver horários ativos sobrepostos; nenhum registro é removido ou alterado silenciosamente.
Aplicar migrations antes do novo código. Reversão: voltar ao código anterior, preservando campos, tabelas e volume. Não executar contração ou DROP automático.


A chave enviada ao provider é derivada da identidade do negócio e da chave do pedido, em formato UUID. Assim, a mesma chave pública usada em negócios diferentes não cruza cobranças.
O endpoint público não altera o nome de um cliente já cadastrado ao encontrar o mesmo telefone; atualização de cadastro fica a cargo do painel autenticado.
QR Code e copia-e-cola são retornados somente enquanto a cobrança está pendente e válida; tornam-se `null` após vencimento ou pagamento.


## Dados de demonstração

Execute `pnpm db:seed` após `pnpm db:up` e `pnpm db:migrate`. O comando usa o driver Postgres já instalado, sem nova dependência.
O seed é transacional e idempotente: repetir não duplica dono, negócio, serviços ou horários. Execuções simultâneas são serializadas.
Não redefine cadastros já existentes, não troca o dono de um slug ocupado e não cria reservas ou pagamentos. Fica bloqueado em produção.

- Negócio: **Barbearia Demo**.
- Slug: **`barbearia-demo`**. API de serviços: `/api/public/barbearia-demo/services`; página prevista: `/barbearia-demo`.
- Dono de teste: **`dono-demo@example.com`**.
- Login: **link mágico, sem senha**. Configure SMTP de testes para capturar o email e solicite `POST /api/auth/sign-in/magic-link` com `{ "email": "dono-demo@example.com", "callbackURL": "/" }`. Abra o link recebido. O domínio `example.com` é fictício; não há caixa de email real nem senha padrão.
- Funcionamento: segunda a sábado, **09:00–18:00**, no fuso **America/Sao_Paulo**. Domingo fechado.

| Serviço fictício | Duração | Preço em centavos | Sinal em centavos |
| --- | --- | --- | --- |
| Corte | 30 minutos | 3500 | 1000 |
| Barba | 30 minutos | 2500 | 500 |
| Corte e barba | 60 minutos | 5500 | 1500 |

Preços e horários acima são dados de teste, não uma definição comercial do produto.

## B02 — autoridade auth/Pix e origens locais

Autoridade: http://localhost:3000. Em desenvolvimento, origem exata permitida: localhost na porta3000 (app único). Usar localhost, nunca alternar com127.0.0.1. Em produção somente origem de BETTER_AUTH_URL; portas locais não são automaticamente confiáveis. Cookies Better Auth permanecem HttpOnly, SameSite=Lax e host-only (sem Domain; Secure em HTTPS). Browser deve usar credentials: include; Server Components encaminham Cookie somente à autoridade fixa. Callbacks absolutos das origens permitidas aceitos pela biblioteca.

GET/POST auth e GET/PUT/DELETE pix-key recebem CORS credenciado somente para origem exata permitida. OPTIONS valida origem, método e headers solicitados; devolve204 com Allow-Origin específico, Allow-Credentials:true, Allow-Methods e Allow-Headers(Content-Type,Authorization). Origem externa/método/header alheio responde403 sem Allow-Origin. Respostas têm Vary:Origin e no-store. CORS não substitui sessão, tenant, CSRF ou cifragem; mutações Pix continuam exigindo Origin válido. Chamadas server-side GET sem Origin permanecem permitidas.

Fixture B02: `NODE_ENV=development node scripts/create_backend_fixture.mjs /caminho/privado/fixture.json`. Exige banco local, autoridade localhost3000 e segredo Pix válido; cria somente usuário/negócio/serviço/horários sintéticos e sessão de1h. Arquivo0600 exclusivo contém Cookie/IDs, nunca versionar nem copiar para frontend/logs. Prova sessão/tenant/Pix; não valida link mágico nem entrega SMTP. Cookie do servidor continua sem Domain, sem tornar endpoint público de bypass. Fixture operacional disponível nesta máquina em `/tmp/agenda-backend-b02-fixture.json`; expira em1h.

## F01 — contrato de provisionamento pós-auth (implementado no backend)

Origem de produção única: `BETTER_AUTH_URL` define a origem canônica (protocolo, host e porta). Em produção não são adicionadas portas de desenvolvimento nem domínios de consumidores. O app final deve publicar interface e autoridade nessa mesma origem; :3000 permanece a única autoridade local. Não usar wildcard nem abrir origens extras para contornar a integração.

Migration 0006 é expansiva: adiciona somente `onboarding_requests`, preservando tabelas e dados existentes. Aplicar antes de habilitar POST onboarding. Reversão operacional: voltar ao código anterior e manter a tabela/registro de migration; o código anterior não a utiliza. Não apagar a tabela nem suas chaves/resultados no rollback. Remoção posterior exige tarefa própria de retenção de dados. Prova isolada: `node scripts/verify_onboarding.mjs` aplica migrations duas vezes, testa concorrência/replay/isolamento e remove somente o banco temporário criado pelo próprio script.

Implementado por T1; consumo T5 após aplicar migration 0006 na autoridade. `POST /api/onboarding`, JSON estrito `{business:{name,slug,timezone?},service:{name,durationMinutes,priceCents,depositCents},hours:[{weekday,opensAt,closesAt}]}`. Nome do negócio e serviço com trim,1..120 caracteres; slug1..100 caracteres no padrão /^[a-z0-9]+(-[a-z0-9]+)*$/, rejeitando reservados (login, onboarding, preview, dashboard, api, admin, auth, health, ready, webhooks, _next, static, favicon.ico; case-insensitive); serviço conforme lib/validation/service.ts (inteiros até2147483647); timezone IANA válido, default existente America/Sao_Paulo se omitido; hours com1..7 dias, weekday inteiro0..6 sem duplicatas; horas HH:mm, abertura<fechamento, somente dias escolhidos. Dinheiro em inteiros centavos, preço>=0 e0<=sinal<=preço; duração inteira positiva. Não enviar ownerId, businessId, status, trialEndsAt ou plano; rejeitar campos extras.

Exige sessão Better Auth validada pela autoridade, Origin permitido e `Idempotency-Key` UUIDv4. Derivar ownerId da sessão, nunca do formulário. Criar negócio, primeiro serviço e horários em uma transação: ou todos persistem, ou nenhum. Não criar cobrança/assinatura/chave Pix neste endpoint. Trial/assinatura são contrato separado; não assumir ativação apenas por cadastro.

Primeiro pedido responde201 `{businessId,slug,publicPath,serviceId}` (publicPath=`/[slug]`); replay idêntico por mesmo owner+chave responde200 com o mesmo resultado; mesma chave/corpo diferente409 `idempotency_conflict`; slug indisponível409 `slug_unavailable`. Nenhum replay de outro dono lê tenant alheio. O contrato não impõe limite inventado de negócios por dono. Persistir chave/hash/resultado vinculado ao dono para replay; migration 0006 cria onboarding_requests com chave composta ownerId/requestKey e resultado transacional.

Erros padrão `{error:{code,message}}`:400 entrada,401 sem sessão,403 origem,409 conflito,413 corpo>16KiB,503 infraestrutura; no-store. GET/PUT/DELETE não definidos. Após201/200, T5 exibe link real e pode encaminhar para http://localhost:3000/dashboard (mesmo host da autoridade); não duplicar login/UI nem simular sucesso fora de Preview. Testes cobrem conflito slug com rollback do pedido, replay concorrente e isolamento de dois donos. CORS das APIs públicas e onboarding permite somente as origens locais já contratadas; preflight aceita Idempotency-Key. Nenhum consumidor deve remover APIs locais antes da prova autenticada.

## Antiabuso de reservas

POST reservas mantém corpo/chave e respostas201/200/409. Dois baldes por minuto, contador atômico PostgreSQL (compartilhado por processos): por par negócio+cliente (`BOOKING_RATE_LIMIT_PER_CLIENT`, padrão10) e teto do negócio (`BOOKING_RATE_LIMIT_PER_BUSINESS`, padrão120). O balde do cliente é consumido primeiro; tentativas recusadas nele não consomem o teto do negócio, então um cliente sozinho usa no máximo o seu limite. Excesso429 `rate_limited`, Retry-After:60; reenvio com mesma Idempotency-Key preserva idempotência de negócio e não renova reserva, mas também consome o limite de tentativas. Não recriar pedido com nova chave por erro transitório.

Identidade do cliente: com `BOOKING_TRUST_PROXY=true`, `BOOKING_CLIENT_IP_HEADER=x-real-ip` (padrão) usa X-Real-IP válido; `x-forwarded-for` usa a regra rightmost-trusted, o item na posição `BOOKING_TRUSTED_PROXY_HOPS` (padrão1) a partir da direita. Usar apenas quando o proxy de entrada sobrescreve/anexa esse header e impede acesso direto ao Next. Sem proxy confiável, usa o último item de X-Forwarded-For, que o Next preenche com o endereço do socket quando ausente; um cliente pode forjá-lo, mas só se divide em baldes próprios (o teto do negócio limita o total) e não esgota o balde de outros. IPv6 é agrupado por /64; IPv4 mapeado é normalizado. Header ausente/inválido resulta em identidade nula: só o teto do negócio se aplica, nunca um balde anônimo compartilhado de10. Configuração inválida responde `503 booking_unavailable`. Endereço não é armazenado: HMAC com segredo do servidor, combinado ao tenant. Registros obsoletos>24h são removidos oportunisticamente em lotes100; não há corpo/telefone/IP bruto.

Migration aditiva cria apenas contadores, preservando schema/dados existentes. Aplicar antes do novo código; processos antigos continuam compatíveis mas sem limite até atualização. Reversão preferida: voltar ao commit anterior e manter tabela aditiva; remoção da tabela só depois de nenhum novo leitor/escritor ativo, com aprovação operacional. Nunca remover reservas/pagamentos ao reverter.

## Readiness

`GET /api/health` permanece liveness200. `GET /api/ready` (novo):200 `{status:"ready"}` se SELECT1 PostgreSQL e autenticação/conexão SMTP passam;503 `{status:"unavailable"}` em qualquer falha. Sem autenticação, no-store, sem nomes de servidores, credenciais, erros brutos ou PII. Não envia e-mail, não cria cobrança, não testa domínio/remetente ou entrega do destinatário; pagamento bancário continua gate separado.
