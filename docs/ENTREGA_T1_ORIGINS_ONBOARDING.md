# T1 — canonical origin, public CORS and onboarding

## Escopo

Produção aceita somente a origem de `BETTER_AUTH_URL`; desenvolvimento preserva localhost3000 (app único). APIs públicas e onboarding recebem CORS credenciado e preflight com Idempotency-Key. Nenhuma autoridade de auth ou webhook foi criada fora do backend.

POST `/api/onboarding` exige origem permitida, sessão e entrada estrita. O dono vem da sessão. Negócio, primeiro serviço, horários e resultado de idempotência são gravados numa transação. Chave composta por dono/UUID evita replay entre tenants; conflitos de corpo/slug respondem 409.

## Migration e reversão

0006 adiciona somente onboarding_requests. Código antigo segue compatível. Aplicar antes de habilitar o endpoint; rollback de aplicação mantém tabela e resultados para preservar dados. Não foi aplicada ao banco compartilhado nesta entrega.

## Provas

Lint sem warnings, Next typegen + TypeScript e 88 testes unitários passaram. `node scripts/verify_onboarding.mjs` fora do sandbox criou banco exclusivo, aplicou migrations duas vezes, passou teste integrado de cinco pedidos concorrentes/replay/conflito/isolamento e removeu o banco exclusivo. Não alterou webhook_deliveries do banco compartilhado.

O comportamento de origem única já existia; regressão agora prova aceitação da origem canônica e rejeição de portas locais/outro domínio antes de executar escrita em produção. Sem novos pacotes.

## Pendências

Revisão independente solicitada no handoff. Aplicação da migration no ambiente real e prova autenticada do consumidor ficam para integração autorizada. Não comprova SMTP real, Pix bancário ou implantação. Mudanças documentais/operacionais anteriores fora deste escopo permanecem sem inclusão no commit. Sem merge/push/deploy.
