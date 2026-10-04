# Contratos de agendamento e pagamento

## Escopo e estado

Este contrato registra a base técnica e o fluxo público de reserva com Pix simulado mantidos pela autoridade backend. Nesta worktree, o painel usa Server Components e Server Actions com PostgreSQL real; autenticação, rotas públicas e webhooks não são publicados localmente. Gateway bancário real não está implementado.

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

Cada leitura e gravação do painel deve validar a sessão e filtrar pelo negócio pertencente ao usuário autenticado.
`findOwnedBusiness` exige o identificador do negócio e o usuário obtido da sessão; retorna `null` para negócio alheio ou inexistente.
`ownerId` nunca deve vir de um formulário ou corpo HTTP.
Chaves estrangeiras compostas impedem relacionar um agendamento a serviço/cliente alheio ou um pagamento a agendamento alheio.
Essas chaves protegem referências; não substituem autorização de leitura. Rotas públicas expõem apenas serviços e horários; dados da reserva exigem token de acesso.
Os testes com Postgres exercitam a consulta por dono e as referências cruzadas entre negócios.

Exclusões de domínio usam `RESTRICT` para evitar perda silenciosa de histórico financeiro.
A exclusão de conta e a política de retenção LGPD ainda precisam de definição do humano; não há endpoint destrutivo nesta etapa.

## Rotas do processo

| Método e rota | Comportamento |
| --- | --- |
| `GET /` | Página provisória do esqueleto. |
| `GET /api/health` | `200` com `{ "status": "ok" }`; saúde do processo HTTP, sem consultar dependências. |
| `GET/POST /api/auth/[...all]` | Backend autoridade; não servido pelo dashboard. Validação de entrada e origem feita pelo Better Auth. |
| `POST /api/auth/sign-in/magic-link` | Backend autoridade recebe email e callback e envia link por SMTP configurado. |
| `GET /api/auth/magic-link/verify` | Backend autoridade consome link válido e cria sessão. |
| `GET /api/auth/get-session` | Backend autoridade responde sessão atual ou ausência. No dashboard, esta rota retorna 404. |
| `POST /api/auth/sign-out` | Backend autoridade encerra sessão. |

A configuração é validada com Zod quando usada. Build não abre conexão ao banco nem exige segredos.
Solicitação de link com SMTP inválido falha; nunca simula envio nem revela link no terminal.

## Rotas previstas

| Área | Rotas propostas | Responsável |
| --- | --- | --- |
| Página pública | `GET /[slug]` | Terminal 4 |

## Painel administrativo implementado — contrato aprovado por T1

T1 aprovou este caminho em 2026-10-03. O caminho administrativo atual é interno ao Next.js: Server Components consultam `lib/dashboard/data.ts`; formulários chamam `app/dashboard/(owner)/actions.ts`. Essas funções acessam Drizzle somente no servidor. Os endpoints REST administrativos anteriormente previstos não existem e não são requisito para este painel. Esta documentação descreve o comportamento existente, sem mudar código, schema ou endpoints públicos. T2 mantém o dashboard; alterações incompatíveis deste contrato exigem alinhamento prévio com T1.

### Leituras e sessão

- `/dashboard`: agenda do dia ou semana. Query `businessId` seleciona negócio do dono; `date` usa `YYYY-MM-DD`; `view=week` seleciona segunda a domingo. Data inválida mostra aviso e usa hoje no fuso do negócio. A agenda apresenta o estado persistido, sem expirar reservas no cliente.
- `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings`: serviços, clientes e funcionamento do negócio selecionado.
- `requireOwner()` verifica sessão pela autoridade configurada em `NEXT_PUBLIC_BACKEND_URL` (local: `http://localhost:3000`), encaminhando somente Cookie a `/api/auth/get-session`, sem cache e sem seguir redirects. Sem sessão, páginas e ações redirecionam para `/dashboard/login`; `ownerId` nunca vem do formulário.
- `ownerContext()` lista somente negócios do dono; sem `businessId`, escolhe o primeiro. Negócio alheio ou inexistente não é selecionado e mostra estado indisponível, sem consultar seus dados.
- Consultas de serviços/clientes/funcionamento/agenda verificam `findOwnedBusiness` antes de ler e filtram `businessId`; joins da agenda incluem vínculo ao mesmo negócio. Datas são exibidas no fuso do negócio.

### Gravações por Server Actions

| Ação | FormData aceito | Resultado |
| --- | --- | --- |
| `saveService(previousState, form)` | `businessId` UUID; `id` UUID opcional; `name`; `durationMinutes`; `price` e `deposit` em reais com vírgula ou ponto e até duas casas; `active=on` significa ativo, ausência significa inativo | Cria serviço sem `id` ou atualiza serviço desse negócio com `id`. Retorna `{ success: "Serviço salvo." }` ou `{ error: string }`. |
| `saveHours(previousState, form)` | `businessId` UUID; para cada dia 0–6, `open-N=on`, `start-N` e `end-N` em `HH:mm` | Substitui todos os dias de funcionamento em transação, com lock do negócio. Dias não marcados ficam fechados; nenhum marcado fecha toda a agenda. Retorna `{ success: "Horários de funcionamento salvos." }` ou `{ error: string }`. |

As ações revalidam a sessão em cada chamada, inclusive chamadas diretas. Os dados normalizados passam por Zod no servidor: nome não vazio até 120 caracteres, duração inteira de 1 a 1440 minutos, valores inteiros em centavos de 0 a 2.147.483.647 e sinal menor ou igual ao preço. Horários exigem abertura anterior ao fechamento, dias únicos e no máximo sete dias. Preços e sinais de reservas anteriores não são alterados ao editar serviço.

Negócio inacessível e serviço não pertencente ao negócio geram erros de domínio internos, convertidos em mensagem de formulário; não se promete status HTTP REST para Server Actions. Erros de validação e infraestrutura retornam mensagens próprias sem detalhes SQL. Falhas de leitura usam a tela de erro do painel. Autenticação ausente redireciona, em vez de retornar sucesso ou erro de formulário.

Depois de salvar, `revalidatePath("/dashboard", "layout")` atualiza leituras do painel. Esta etapa não oferece edição de clientes, cadastro/configuração do negócio, alteração de status de reserva ou operação administrativa de pagamento. Serviços e funcionamento gravam dados reais; isso não torna o Pix fake uma cobrança bancária real.

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
A reserva com sinal vence em 15 minutos ou no início do atendimento, o que ocorrer primeiro. Sinal zero confirma sem criar pagamento.
Um negócio atende um cliente por vez. Intervalos são semiabertos: um horário pode começar exatamente quando o anterior termina.
Disponibilidade usa o fuso do negócio e o intervalo de funcionamento do dia. Inícios avançam pela duração do serviço desde a abertura.
Reservas pendentes vencidas não ocupam disponibilidade. Ao criar nova reserva, elas são marcadas como expiradas antes da disputa pelo horário.
Concorrência é protegida por lock transacional do negócio e restrição de exclusão no Postgres. Não há confirmação após liberar uma reserva vencida.

## Rotas públicas da autoridade backend

- `GET /api/public/[slug]/services`: nome e fuso do negócio e serviços ativos com `id`, `name`, `durationMinutes`, `priceCents`, `depositCents`.
- `GET /api/public/[slug]/availability?serviceId=<uuid>&date=YYYY-MM-DD`: responde `{ timezone, slots: [{ startsAt, endsAt }] }`. Datas de horários são ISO 8601 UTC. Lista vazia significa fechado, passado ou sem vagas.
- `POST /api/public/[slug]/bookings`: exige header `Idempotency-Key` UUID v4 e JSON `{ serviceId, startsAt, customer: { name, phone } }`. Telefone em E.164. Responde `201` com `{ bookingId, status, startsAt, endsAt, expiresAt, accessToken, payment }`; repetição idêntica responde `200`. Mesma chave com outro corpo responde `409`.
- `GET /api/public/[slug]/bookings/[id]/payment`: exige `Authorization: Bearer <accessToken>`. Responde `{ bookingId, status, expiresAt, payment }`. Não retorna nome, telefone nem dados do dono.

`payment` é `null` com sinal zero; caso contrário contém `{ id, provider, externalId, amountCents, status, expiresAt, qrCodeDataUrl, copyPaste }`.
O token de acesso é derivado com HMAC e contexto próprio usando o segredo do servidor; só seu hash é armazenado. UUID da reserva não autoriza leitura.
A chave de idempotência permite recuperar a resposta com o mesmo corpo e deve ser tratada como credencial: gerar com `crypto.randomUUID()`, não registrar em analytics e não reutilizar em outro pedido.
Repetições não renovam vencimento nem criam segunda cobrança. Campos extras, preço fornecido pelo cliente e datas sem fuso são rejeitados.
Respostas de domínio usam `Cache-Control: no-store`.

Erros: `{ error: { code, message } }`, sem detalhes pessoais ou internos. `400` entrada inválida; `404` negócio/serviço/reserva inacessível; `409` horário ocupado ou chave reutilizada; `413` corpo acima de 16 KiB; `503` pagamento indisponível; `500` falha interna.

## PaymentProvider e fake

`PaymentProvider.createPixCharge` recebe chave de idempotência, centavos e vencimento; retorna identificador externo, centavos, vencimento, QR Code e copia-e-cola.
O provider deve criar no máximo uma cobrança por chave e repetir a resposta após falhas transitórias. Valores retornados são validados antes de persistir.
`PaymentProvider.verifyWebhook` autentica o corpo bruto e normaliza o evento. O domínio não interpreta protocolo do gateway.
Somente fake existe nesta etapa. Exige `PAYMENT_PROVIDER=fake`, segredo `FAKE_WEBHOOK_SECRET` exclusivo com ao menos 32 caracteres e ambiente diferente de produção.
QR Code PNG codifica texto prefixado `FAKE-PIX-NOT-PAYABLE`, não é um Pix bancário. A dependência `qrcode` é necessária para gerar QR Code padrão, sem implementar algoritmo próprio.
A chamada ao provider ocorre na transação de reserva. Antes de um gateway real, revisar timeout e recuperação de cobranças externas; idempotência da interface já é obrigatória.

## Webhook

`POST /api/webhooks/payments/fake` é servido somente pela autoridade backend. O dashboard retorna 404 e não processa webhooks. O endpoint backend recebe JSON estrito:

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

Cada entrega gera linha em `webhook_deliveries`, inclusive assinatura inválida, corpo inválido e repetição. Guarda provider, identificador validado quando disponível, hash do corpo, resultado e motivo; nunca guarda assinatura ou corpo bruto.
`payment_events` tem identidade única por provider e evento, hash do evento normalizado, identificador da cobrança e resultado. Evento já visto com mesmo conteúdo é duplicado; conteúdo diferente com mesmo identificador responde `409`.
Deduplicação, alteração do pagamento, confirmação da reserva e resultado do evento ocorrem na mesma transação.
Somente cobrança identificada pelo provider e identificador externo pode ser alterada. Valor deve corresponder à cobrança e ao sinal contratado.
Pagamento válido recebido a tempo confirma somente reserva pendente ainda válida. Pagamento tardio registra dinheiro recebido, mas não reabre horário: resultado `ignored`, motivo `late_payment`, requer avaliação do dono antes de um gateway real.
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

## B-02 — Consumo do painel

Auth client (login e logout) e Pix GET/PUT/DELETE usam a origem pública fixa de `NEXT_PUBLIC_BACKEND_URL`, com credentials include. Em desenvolvimento: localhost3000 para autoridade e localhost3343 para painel; não alternar com127.0.0.1. Callbacks do link mágico são absolutos na origem do painel: /dashboard e /dashboard/login?error=link. A configuração pública é incorporada no build; produção exige a origem HTTPS correta, não o fallback local.

Server Components e Server Actions validam sessão na autoridade antes de consultar/gravar com Drizzle. Encaminham somente Cookie, nunca Host/Origin/Authorization de entrada, sem cache/redirects; resposta é validada com Zod. Falha de transporte/resposta inválida falha fechada com mensagem segura, sem fingir logout ou sessão válida. Queries/ações mantêm autorização tenant/Zod/centavos/transação existentes. Banco do processo do painel deve ser o mesmo banco validado da autoridade.

Pix preserva input password não controlado, limpeza após tentativa, máscaras type/hint e estados após resposta real. APIs e implementação auth locais permanecem durante esta transição, sem remoção antecipada. CORS/origins/cifragem continuam responsabilidades da autoridade. Contrato backend aprovado em29f3b75/1332daa; esta alteração não prova integração autenticada sem fixture/DB sintéticos atuais.
