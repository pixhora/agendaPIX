# Configuração de Cron para Reconciliação no Vercel

## Problema Identificado

O processo de reconciliação (`/api/cron/reconcile`) precisa rodar com frequência suficiente para lidar com holds de pagamento que expiram em ~10 minutos (`BOOKING_HOLD_MINUTES`). Se configurado para rodar apenas 1x por dia, webhooks perdidos ou atrasados do Mercado Pago deixam pagamentos pendentes até o dia seguinte, enquanto os holds já expiraram.

## Solução

### Opção 1: Vercel Cron (Recomendado para Vercel)

Se o app estiver hospedado no Vercel, criar um endpoint de API e configurar cron no `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Frequência recomendada:**
- `*/5 * * * *` - a cada 5 minutos (12x por hora)
- `*/3 * * * *` - a cada 3 minutos (20x por hora) para holds mais curtos
- `*/1 * * * *` - a cada 1 minuto (60x por hora, limite do Vercel Free/Pro)

**Limites do Vercel:**
- Hobby/Free: até 1 cron job, mínimo 1 minuto
- Pro: até 20 cron jobs, mínimo 1 minuto
- Enterprise: custom

### Endpoint de API para Vercel Cron

Criar `app/api/cron/reconcile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { getPaymentProvider } from "@/lib/payments";
import { reconcileOnce } from "@/lib/payments/reconcile";
import { paymentsConfig } from "@/lib/payments/config";

export const runtime = "nodejs";
export const maxDuration = 60; // segundos (ajuste conforme plano Vercel)

export async function GET(request: NextRequest) {
  // Autenticação: Vercel injeta Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const provider = getPaymentProvider();
    const report = await reconcileOnce(getDb(), provider, paymentsConfig());
    
    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Reconcile cron error:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

### Variáveis de Ambiente

Adicionar no Vercel Dashboard (Settings → Environment Variables):

```bash
CRON_SECRET=<gere-com-openssl-rand-base64-32>
```

**Importante:** o `CRON_SECRET` deve ser diferente de `BETTER_AUTH_SECRET`, `BOOKING_ACCESS_SECRET`, etc.

### Opção 2: Self-Hosted (Docker/Coolify)

Se o app estiver em VPS/Docker (configuração atual do projeto), usar o worker dedicado já existente:

**docker-compose.yml** (já configurado):
```yaml
services:
  reconcile:
    image: agenda-backend:latest
    command: ["pnpm", "reconcile:prod"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      # ... outras envs
      RECONCILE_INTERVAL_SECONDS: 60  # 1 minuto
    depends_on:
      - postgres
    restart: unless-stopped
```

**Ou via systemd timer:**

```ini
# /etc/systemd/system/agenda-reconcile.timer
[Unit]
Description=Reconciliação de pagamentos Pix a cada 5 minutos

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
AccuracySec=30s

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/agenda-reconcile.service
[Unit]
Description=Reconciliação de pagamentos Pix

[Service]
Type=oneshot
WorkingDirectory=/opt/agenda
ExecStart=/usr/bin/node dist/reconcile.mjs --once
EnvironmentFile=/opt/agenda/.env
User=agenda
```

Ativar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agenda-reconcile.timer
sudo systemctl list-timers  # verificar
```

## Frequência Ideal

Baseado em `BOOKING_HOLD_MINUTES=10`:

| Hold | Frequência Mínima | Frequência Ideal | Latência Máxima |
|------|-------------------|------------------|-----------------|
| 10min | 5min | 3min | 3-5min |
| 5min | 2min | 1min | 1-2min |
| 15min | 7min | 5min | 5-7min |

**Regra geral:** intervalo de reconciliação ≤ hold / 2

## Testes

Verificar se o cron está funcionando:

```bash
# Vercel: verificar logs no Dashboard → Deployments → Functions
# Ou chamar manualmente (com auth):
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://seu-app.vercel.app/api/cron/reconcile

# Self-hosted:
docker logs -f agenda-reconcile
# ou
journalctl -u agenda-reconcile.service -f
```

## Migração de Daily para Frequente

Se já existe `vercel.json` com schedule diário:

```diff
  "crons": [
    {
      "path": "/api/cron/reconcile",
-     "schedule": "0 0 * * *"
+     "schedule": "*/5 * * * *"
    }
  ]
```

Redeploy no Vercel após a mudança.

## Monitoramento

Recomendado:
- Alertas se reconcile não rodar por > 2× o intervalo configurado
- Métricas: `stuckRetried`, `expiredCancelled`, `polledPaid` (disponíveis no report)
- Log de erros 500 no endpoint de cron

## Referências

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Cron Syntax](https://crontab.guru/)
- Código: `scripts/reconcile.ts`, `lib/payments/reconcile.ts`
