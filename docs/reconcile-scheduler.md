# Reconciliador em produção: agendador externo

Na Vercel Hobby o cron nativo só roda **uma vez por dia** (`vercel.json`: `0 6 * * *` UTC). O webhook
do Mercado Pago é o caminho principal de confirmação do Pix; o reconciliador é a rede de segurança
(cobranças `creating` presas, cancelamento no gateway de cobranças vencidas, webhooks perdidos).
Para rodar com mais frequência, um agendador externo chama:

```
POST https://www.agendapix.dev.br/api/cron/reconcile
Authorization: Bearer <CRON_SECRET>
```

- `200` + JSON com contadores (`stuckRetried`, `expiredCancelled`, `polledPaid`, ...) = ok.
- `401` = bearer errado · `503` = `CRON_SECRET` ausente/curto na Vercel ou banco indisponível.
- Chamadas simultâneas são seguras: a passagem usa `pg_try_advisory_lock` e só uma roda por vez.
  Dá para usar GitHub Actions **e** cron-job.org ao mesmo tempo.

## Opção A — GitHub Actions (opt-in, desligada por padrão)

Arquivo: `.github/workflows/reconcile-cron.yml` (a cada 30 min, minutos `7,37`, e `workflow_dispatch`).
Só roda com a variável de repositório `RECONCILE_CRON_ENABLED=true`. Enquanto o Actions da conta estiver
bloqueado por cobrança, o workflow não executa: use a Opção B.

1. Ponha o **mesmo** `CRON_SECRET` da Vercel num secret do repositório. As variáveis do projeto na Vercel
   são do tipo *sensitive* (não dá para ler o valor depois de criado), então:
   - se você ainda tem o valor guardado: Settings → Secrets and variables → Actions → New repository
     secret `CRON_SECRET` (ou `gh secret set CRON_SECRET -R pixhora/agendaPIX` e cole no prompt);
   - senão, **rotacione** nos dois lugares sem exibir o valor e faça redeploy:
     ```bash
     NEW=$(openssl rand -hex 32)
     printf %s "$NEW" | gh secret set CRON_SECRET -R pixhora/agendaPIX
     vercel env rm CRON_SECRET production --yes
     printf %s "$NEW" | vercel env add CRON_SECRET production --sensitive
     unset NEW
     vercel deploy --prod   # env nova só vale após novo deploy
     ```
     (atualize também o header do cron-job.org, se usar a opção B).
2. Ligue com a variável `RECONCILE_CRON_ENABLED=true` (e, opcional, `RECONCILE_URL` para outro domínio). Para pausar, apague a variável ou ponha `false`.
3. Depois do merge em `master`: Actions → *Reconcile (external scheduler)* → **Run workflow** e confira
   `HTTP 200` no log.

Limitações:
- Agendamentos do GitHub só valem no branch padrão e podem atrasar (às vezes 10+ min) em horários de pico.
- Repo privado: cada execução conta **1 minuto** de Actions. A cada 30 min ≈ 1.440 min/mês; o plano
  Free tem 2.000 min/mês para repositórios privados (dividido com o CI). A cada 5 min seriam ≈ 8.640
  min/mês — use a opção B para essa frequência.

## Opção B — cron-job.org (gratuito, até 1/min) — recomendada

1. Crie conta em https://cron-job.org → **Create cronjob**.
2. URL: `https://www.agendapix.dev.br/api/cron/reconcile`; Schedule: a cada 5 minutos.
3. Advanced → Request method **POST**; Headers → `Authorization` = `Bearer <CRON_SECRET>`.
4. Timeout: 60 s (o máximo da função é 60 s). Ative notificação de falha por e-mail.
5. **Test run** → deve responder `200`.

Se o `CRON_SECRET` for rotacionado na Vercel, atualize também o secret do GitHub e o header do cron-job.org.

## Vercel Pro

Com Pro dá para dispensar o agendador externo: troque o `schedule` no `vercel.json` para `*/5 * * * *`.
