# Reconciliador em produção: agendador externo

Na Vercel Hobby o cron nativo só roda **uma vez por dia** (`vercel.json`: `0 6 * * *` UTC). O webhook
do Mercado Pago é o caminho principal de confirmação do Pix; o reconciliador é a rede de segurança
(cobranças `creating` presas, cancelamento no gateway de cobranças vencidas, webhooks perdidos).
Para rodar com mais frequência, um agendador externo chama:

```
POST https://agendapix-seven.vercel.app/api/cron/reconcile
Authorization: Bearer <CRON_SECRET>
```

- `200` + JSON com contadores (`stuckRetried`, `expiredCancelled`, `polledPaid`, ...) = ok.
- `401` = bearer errado · `503` = `CRON_SECRET` ausente/curto na Vercel ou banco indisponível.
- Chamadas simultâneas são seguras: a passagem usa `pg_try_advisory_lock` e só uma roda por vez.
  Dá para usar GitHub Actions **e** cron-job.org ao mesmo tempo.

## Opção A — GitHub Actions (já no repositório)

Arquivo: `.github/workflows/reconcile-cron.yml` (a cada 30 min, minutos `7,37`, e `workflow_dispatch`).

1. Copie o `CRON_SECRET` da Vercel para um secret do repositório **sem exibi-lo**:
   ```bash
   vercel env pull /tmp/.env.prod --environment=production --yes \
     && grep '^CRON_SECRET=' /tmp/.env.prod | cut -d= -f2- | tr -d '"' | gh secret set CRON_SECRET -R voidFrance/agendaPIX \
     && rm -f /tmp/.env.prod
   ```
   (ou cole manualmente em Settings → Secrets and variables → Actions → New repository secret).
2. Opcional: variável `RECONCILE_URL` (outro domínio) e `RECONCILE_CRON_ENABLED=false` para pausar.
3. Depois do merge em `master`: Actions → *Reconcile (external scheduler)* → **Run workflow** e confira
   `HTTP 200` no log.

Limitações:
- Agendamentos do GitHub só valem no branch padrão e podem atrasar (às vezes 10+ min) em horários de pico.
- Repo privado: cada execução conta **1 minuto** de Actions. A cada 30 min ≈ 1.440 min/mês; o plano
  Free tem 2.000 min/mês para repositórios privados (dividido com o CI). A cada 5 min seriam ≈ 8.640
  min/mês — use a opção B para essa frequência.

## Opção B — cron-job.org (gratuito, até 1/min) — recomendado para 1–5 min

1. Crie conta em https://cron-job.org → **Create cronjob**.
2. URL: `https://agendapix-seven.vercel.app/api/cron/reconcile`; Schedule: a cada 5 minutos.
3. Advanced → Request method **POST**; Headers → `Authorization` = `Bearer <CRON_SECRET>`.
4. Timeout: 60 s (o máximo da função é 60 s). Ative notificação de falha por e-mail.
5. **Test run** → deve responder `200`.

Se o `CRON_SECRET` for rotacionado na Vercel, atualize também o secret do GitHub e o header do cron-job.org.

## Vercel Pro

Com Pro dá para dispensar o agendador externo: troque o `schedule` no `vercel.json` para `*/5 * * * *`.
