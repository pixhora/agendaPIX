# Go-live: checklist de produção

Produção: https://www.agendapix.dev.br · Vercel `agendapix` (região `gru1`) · Neon `AgendaPIx`,
branch `production`, banco `neondb`. Detalhes de infraestrutura em [`deploy-vercel.md`](./deploy-vercel.md).
Nunca cole valores de segredos em issues, PRs, chats ou logs.

## Status verificado (2026-10-10)

Verificado contra produção, sem usar segredos:

- [x] `GET /api/health` = 200 e `GET /api/ready` = 200 (banco + SMTP).
- [x] `POST /api/cron/reconcile` responde 401 sem o bearer correto (rota no ar e protegida).
- [x] `POST /api/webhooks/payments/mercadopago` responde 401 com assinatura inválida (rota no ar e protegida).
- [x] Migrations 0018 e 0019 aplicadas no Neon `production`.
- [ ] Páginas legais: `/termos` e `/privacidade` respondem 404 (publicação desligada). Decisão de produto.
- [ ] Reconciliador frequente: hoje só roda o cron diário da Vercel. Falta ligar um agendador externo
      (cron-job.org, ver [`reconcile-scheduler.md`](./reconcile-scheduler.md)). O webhook continua sendo o caminho principal.
- [ ] Teste real com Pix de R$ 1 (seção 2). Exige conta Mercado Pago de produção e um banco de outra titularidade.
- [ ] Valores das variáveis (seção 3): não verificáveis de fora, pois são sensíveis na Vercel.

## 0. Pré-requisitos de código/banco

- [ ] Migrations em dia no Neon `production`, usando a URL **direta** (sem `-pooler`):
      `DATABASE_URL=<direta> pnpm db:migrate`. Rode **antes** de publicar uma release que traga
      migration nova (ex.: `0010_provider_charge_references`, que guarda o mapeamento reference → order do MP).
- [ ] Reconciliador frequente configurado (o cron da Hobby é diário): ver
      [`reconcile-scheduler.md`](./reconcile-scheduler.md). Teste manual com resposta `200`.
- [ ] `GET /api/health` = 200 e `GET /api/ready` = 200 (banco + SMTP).

## 1. Mercado Pago: de sandbox para produção

O código usa a mesma URL de API nos dois modos. Quem define o ambiente é o **access token**;
`MERCADOPAGO_ENV` só registra o tipo de credencial (e precisa bater com ele).

- [ ] Use uma **conta MP limpa**, a do recebedor real, com cadastro/KYC aprovado e **chave Pix cadastrada**
      (sem chave Pix a conta não emite QR).
- [ ] Suas integrações → aplicação → **Credenciais de produção** → ativar (setor + site
      `https://www.agendapix.dev.br`). Copie o **Access Token de produção** (`APP_USR-...`).
      Não use o token de teste (`TEST-...`) nem o de usuário de teste.
- [ ] Vercel (Production), sem exibir valores:
      - `MERCADOPAGO_ACCESS_TOKEN` = token de produção
      - `MERCADOPAGO_ENV` = `production`
      - `PAYMENT_PROVIDER` = `mercadopago`
      - `MERCADOPAGO_BASE_URL` deve estar ausente (usa `https://api.mercadopago.com`)
      Troca: `vercel env rm <VAR> production --yes` e depois `vercel env add <VAR> production --sensitive`.
- [ ] **Webhook em modo produtivo:** Suas integrações → aplicação → Webhooks → aba **Modo produtivo**:
      - URL `https://www.agendapix.dev.br/api/webhooks/payments/mercadopago`
      - evento **Order (Mercado Pago)**
      - salvar
- [ ] Copie a **assinatura secreta** mostrada no painel (gere/regenere se preciso) para
      `MERCADOPAGO_WEBHOOK_SECRET` na Vercel. Precisa ter ≥ 32 caracteres. Se for regenerada depois, atualize na Vercel também.
- [ ] `vercel deploy --prod` (ou redeploy do último deploy). Env nova só vale depois de um novo deploy.
- [ ] No painel, use **Simular notificação** do webhook produtivo. Para o app, uma notificação de order
      inexistente é aceitável (404/ignorada). O que importa é **não** responder `401 invalid_signature`.
      Se der 401, o secret está errado.

## 2. Teste real com Pix pequeno (R$ 1)

- [ ] Crie/use um negócio de teste com um serviço de sinal **R$ 1,00** (`depositCents = 100`).
- [ ] Faça uma reserva pela página pública. Confira o QR/copia-e-cola e que o order no painel do MP começa com `ORD` (não `ORDTST`).
- [ ] Pague pelo app do banco com **outra** titularidade (não a da conta recebedora).
- [ ] Em segundos a reserva vira **confirmada** via webhook. Confira no painel: notificação entregue com `200`.
- [ ] Sem webhook, a próxima passagem do reconciliador deve confirmar (`polledPaid` ≥ 1). Isso testa a rede de segurança.
- [ ] Teste também o caminho de **não pagar**: o hold expira, e o reconciliador cancela o order no MP (`expiredCancelled`).
- [ ] Devolva o R$ 1 pelo painel do MP (Atividade → pagamento → Devolver) e remova o negócio/serviço de teste.

## 3. Revisão de variáveis (Vercel → Production)

| Variável | Conferir |
| --- | --- |
| `DATABASE_URL` | Neon `production` **com pooler** |
| `DATABASE_URL_UNPOOLED` | Neon `production` **direta** (usada pelo reconciliador por causa do advisory lock) |
| `BETTER_AUTH_URL` | `https://www.agendapix.dev.br`, sem barra final, igual ao domínio servido |
| `BETTER_AUTH_SECRET` | ≥ 32 chars, exclusivo de produção (trocar desloga todo mundo) |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | remetente verificado; `/api/ready` = 200; link mágico chega |
| `PAYMENT_PROVIDER` | `mercadopago` (em produção o `fake` é recusado) |
| `MERCADOPAGO_ACCESS_TOKEN` | **produção** (`APP_USR-...`) |
| `MERCADOPAGO_ENV` | `production` |
| `MERCADOPAGO_WEBHOOK_SECRET` | do webhook **modo produtivo** |
| `PIX_KEY_ENCRYPTION_KEY` | 64 hex. Guarde um backup fora da Vercel: perder a chave invalida as chaves Pix salvas |
| `CRON_SECRET` | ≥ 32 chars; igual ao do agendador externo (secret do GitHub / cron-job.org) |
| `BOOKING_TRUST_PROXY` / `BOOKING_CLIENT_IP_HEADER` | `true` / `x-real-ip` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |
| `FAKE_WEBHOOK_SECRET`, `MERCADOPAGO_BASE_URL` | **ausentes** |

Os outros `BOOKING_*`, `PAYMENT_PROVIDER_TIMEOUT_MS` e `RECONCILE_*` têm padrão. Só defina se quiser mudar.
Todas as variáveis devem ser *sensitive* e existir só no ambiente **Production**. Preview não deve usar o token MP de produção.

## 4. Depois do go-live

- [ ] Acompanhe os logs da Vercel (`/api/webhooks/payments/*` e `/api/cron/reconcile`) nas primeiras 24 h.
- [ ] Backups do Neon: confira a janela de *point-in-time restore* do plano.
- [ ] Rollback de pagamento: volte o token para teste + `MERCADOPAGO_ENV=sandbox` e faça redeploy.
      Não apague pagamentos já gravados.
