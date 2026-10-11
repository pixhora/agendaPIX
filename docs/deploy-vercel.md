# Deploy em produção: Vercel + Neon + SMTP (Resend ou Gmail)

App único Next.js na Vercel (região `gru1`, São Paulo), Postgres no Neon (região `aws-sa-east-1`),
links mágicos por SMTP (nodemailer) e Pix pelo Mercado Pago.

## O que muda em relação à imagem Docker

| Docker/Coolify | Vercel |
| --- | --- |
| `output: "standalone"` | desligado quando `VERCEL=1` (o builder da Vercel empacota as funções) |
| `node reconcile.mjs` em loop | `GET/POST /api/cron/reconcile` com `Authorization: Bearer $CRON_SECRET` |
| `node migrate.cjs` no deploy | `pnpm db:migrate` uma vez por release, contra a URL **direta** do Neon |
| Pool `pg` com 10 conexões | 5 por instância + `attachDatabasePool` (fecha ociosas antes de suspender) |

A confirmação do Pix em produção depende do **webhook** do Mercado Pago
(`https://<domínio>/api/webhooks/payments/mercadopago`). O cron é rede de segurança: cobranças
`creating` presas, cancelamento no gateway de cobranças vencidas, webhooks perdidos e a única
devolução automática (Pix atrasado sem horário). O prazo de 7 dias da devolução manual não move dinheiro quando vence. O mesmo `POST /api/cron/reconcile` com `Authorization: Bearer $CRON_SECRET` continua
válido para o agendador externo.
Holds vencidos já expiram sozinhos em cada leitura/criação de reserva.

- **Hobby:** a Vercel só aceita cron diário (`vercel.json` usa `0 6 * * *` UTC). Expressões mais
  frequentes fazem o deploy falhar. Para rodar a cada 1–5 min, use um agendador externo
  (cron-job.org, GitHub Actions) chamando `POST /api/cron/reconcile` com o bearer — passo a passo em
  [`reconcile-scheduler.md`](./reconcile-scheduler.md).
  O polling de webhook perdido só olha cobrança `pending` com `expiresAt` ainda no futuro
  (hold padrão de 30 min). Um cron diário quase nunca pega essa janela; o agendador externo
  precisa ser mais frequente que o hold.
- **Pro:** pode trocar para `*/2 * * * *` ou `*/5 * * * *` no `vercel.json` (o mínimo do plano é 1 minuto).

O lembrete da véspera da devolução manual não espera 09:00. Sai na primeira passagem do dia local anterior ao prazo: com `0 6 * * *` UTC, por volta das 03:00 em Brasília. A coluna `manual_refund_reminder_sent_at` impede um segundo envio se o cron passar a rodar a cada poucos minutos.

## Variáveis (Production)

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Neon, string **com pooler** (`...-pooler...neon.tech/...?sslmode=require`) |
| `DATABASE_URL_UNPOOLED` | Neon, string direta (criada pela integração Neon ↔ Vercel) |
| `BETTER_AUTH_URL` | URL pública estável, ex.: `https://agendapix.vercel.app` (sem barra final) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (novo para produção) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Resend: `smtp.resend.com` / `465` / `true` · Gmail: `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASSWORD` | Resend: `resend` / API key · Gmail: endereço / senha de app (exige 2FA) |
| `SMTP_FROM` | Resend: endereço de domínio verificado · Gmail: o próprio endereço |
| `PAYMENT_PROVIDER` | `mercadopago` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token (teste agora; produção depois) |
| `MERCADOPAGO_ENV` | `sandbox` (ou `production` com credenciais de produção) |
| `MERCADOPAGO_WEBHOOK_SECRET` | o secret **gerado pelo painel** do Mercado Pago ao salvar o webhook (pagamento e mp-connect) |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | credenciais OAuth da aplicação; o Pix do sinal usa o token do vendedor, não o da plataforma |
| `MP_OAUTH_REDIRECT_URI` | `https://<domínio>/api/integrations/mercadopago/callback` (https, sem query nem fragmento) |
| `MP_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (cifra o token OAuth do dono) |
| `MP_OAUTH_PKCE` | `on` quando `MERCADOPAGO_ENV=production` e no `next build` com `VERCEL_ENV=production`. Sem isso o boot de produção não sobe e o build da Vercel falha, em vez de publicar um deploy que responde 500. Ausente ou `off` só vale em preview e dev. Espaços nas pontas (` on `) valem `on`. Nunca vazio: string vazia derruba o boot (`mp_oauth_pkce_invalid`) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `SUPPORT_WHATSAPP_NUMBER` | dígitos E.164 sem `+`. Sem isso o checkout da assinatura fica `available: false` |
| `SUBSCRIPTION_MANUAL_ACTIVATION_HOURS` | inteiro ≥ 1, sem zero à esquerda. Sem isso o checkout responde 503 |
| `BOOKING_TRUST_PROXY` | `true` (a Vercel sobrescreve `X-Real-IP`/`X-Forwarded-For`) |
| `BOOKING_CLIENT_IP_HEADER` | `x-real-ip` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (pnpm 12 do `packageManager`) |

## Link de um horário e logs da Vercel

O token do link vai no path (`/api/public/{slug}/slot-links/{token}`). A Vercel registra o path nos logs de request, então o token aparece lá. A aplicação não grava o token (só o sha256) e não o manda no `Referrer`. **Decisão pendente com o Matiss:** por quanto tempo esses logs ficam e quem pode lê-los. Não está aceito como risco fechado.

Enquanto isso, o que já vale:

- o prazo do link é `SLOT_LINK_TTL_MINUTES` (padrão 24 horas, teto de 7 dias) e nunca passa do início do horário;
- depois que o Pix confirma, o token deixa de pagar (`link_used` / status `paid`);
- o acesso aos logs do projeto na Vercel fica restrito ao dono da conta.

`FAKE_WEBHOOK_SECRET` não é usado em produção. Os demais `BOOKING_*`/`RECONCILE_*` têm padrão, menos `BOOKING_ACCESS_SECRET`. Em Production e em Preview ele é obrigatório (`openssl rand -base64 32`), com valores diferentes, pelo menos 32 caracteres, sem o prefixo de exemplo e diferente de `BETTER_AUTH_SECRET`. Vazio, curto, prefixo de exemplo ou igual a `BETTER_AUTH_SECRET` derruba o boot (`NODE_ENV=production`) e o `next build` com `VERCEL_ENV=production` ou `VERCEL_ENV=preview`. A mensagem cita o nome e o motivo, nunca o valor. Fora desses ambientes, vazio ainda cai em `BETTER_AUTH_SECRET`. `BOOKING_ACCESS_SECRET_PREVIOUS` é opcional, com pelo menos 32 caracteres, e só entra na busca do HMAC de um Pix de link de horário já começado. Abaixo de 32 caracteres não entra. O link de acompanhamento compara o sha256 do token gravado; na retomada, a resposta devolve o token (atual ou anterior) cujo sha256 bate com esse hash. Se nenhum bate, volta o token atual, o hash não muda, e o log avisa só o id da reserva para definir `PREVIOUS`. Não rotacione de novo nem apague `PREVIOUS` enquanto o Pix de link de horário começado antes da rotação ainda estiver pendente. `PREVIOUS` pode ser igual a `BETTER_AUTH_SECRET`. Enquanto estiver definido, o boot avisa uma vez, sem o valor, que ele só vale para esse Pix já começado. Se for igual a `BOOKING_ACCESS_SECRET`, avisa de novo, sem o valor. `BOOKING_HOLD_MINUTES` ausente vale 30; abaixo de 28 o agendamento responde `503` `booking_unavailable`. A mensagem cita o nome da env e não o valor. O boot só chama `bookingConfig` com `NODE_ENV=production`. O `next build` com `VERCEL_ENV=production` valida `bookingConfig`, `BOOKING_ACCESS_SECRET` e `MP_OAUTH_PKCE=on` (`assertVercelProductionBuild` em `next.config.ts`). O `next build` com `VERCEL_ENV=preview` valida só `BOOKING_ACCESS_SECRET`, com as mesmas regras. PKCE e `bookingConfig` continuam só no build de produção. Dev não entra. Fora de produção um valor inválido de reserva não derruba o processo; a primeira reserva ainda responde 503. `PIX_KEY_ENCRYPTION_KEY` não é lida pelo código atual (a rota da chave responde 410); não apague a chave se ainda houver ciphertext antigo para guardar. O rollout da migration `0021` está em `docs/CONTRATOS.md`.

## Ordem

1. `neonctl auth` → criar projeto (Postgres 17, `aws-sa-east-1`); copiar URLs pooled e direta.
2. `DATABASE_URL=<direta> pnpm db:migrate` (cria `btree_gist` e aplica 0000–0010).
3. `vercel login` → `vercel link` (projeto novo, ligado ao GitHub `pixhora/agendaPIX`, branch `master`).
4. `vercel env add ... production` para cada variável acima.
5. `vercel deploy --prod` (pelo CLI, para ver erros de validação do `vercel.json`).
6. Conferir `GET /api/health` (200) e `GET /api/ready` (200 = banco + SMTP ok).
7. Mercado Pago → Suas integrações → Webhooks (modo teste): URL
   `https://<domínio>/api/webhooks/payments/mercadopago`, eventos **payment** e **mp-connect**; copiar o secret gerado para
   `MERCADOPAGO_WEBHOOK_SECRET` e fazer redeploy.
8. Teste ponta a ponta: login por link mágico, onboarding, reserva, Pix de teste (APRO), confirmação.
