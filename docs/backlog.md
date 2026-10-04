# Backlog

## Celular lento — `9791651`

- **OK:** comparação local375px/rede lenta/cache vazio; produção3006 reduz load18–18,5s para1,55–1,60s (~91%), JS transferido~95%. Dezoito amostras sem erros; navegação preview1/1 passou.
- **P1 MELHORAR — ambiente/T1:** túnel público ainda entrega dev3001. Coordenar produção isolada, preservando dev; repetir medição pública após URL otimizada.
- Dados brutos/agregados versionados em docs/evidencias; comandos e limites em PROGRESSO.md. Sem alteração especulativa de frontend.

## Assinatura aprovada49/79

- **OK T4 `9791651`:** 4/4 pricing/preview/onboarding passaram; 4900/7900 centavos apresentados como49/79; trial7 preservado.
- **Pendente Trilha:** commit/servidor atualizado para prova de consistência; checkpoint `e1877b4` ainda contém29/59 na landing.
- Serviços/demo/sinais preservados; nenhuma autorização de cobrança inferida.

## Régua `6d12ccf` — encerrada no escopo

- **OK:** 4/4 em 375/1280 claro/escuro; foco/Tab íntegros, fades nos extremos, setas/touch, scrollbar oculta e contraste 10,64:1. P1/P2 anteriores da régua encerrados.
- Provas e screenshots em PROGRESSO.md. Pendências do MVP real permanecem.

## Painel T2 `c16fadd` — prova T3

- **OK:** login SMTP/sessão reais locais; serviços criar/editar/centavos/reload; horários salvar/reload; tenant por URL/formulário; agenda semanal e quatro rotas 375/1280. Playwright 1/1 passou.
- **Pendente:** produção/auth T1 informado pelo autor; ativação real/onboarding e integração das branches. Não declarar CRUD de clientes/reservas, ausente do contrato.
- **Prova limitada:** loading e falha de infraestrutura não provocados no servidor compartilhado. Matriz e screenshots em PROGRESSO.md.

## Régua `0c6b39c`

- **OK / encerrados:** contraste ativo 10,64:1 e scrollbar; setas/touch/gradiente renderizado passaram.
- **P2 T4:** foco/enquadramento por Tab e fade persistente sobre último dia. Quatro cenários ainda falham nesses checks.

## Régua de datas — T3

- **P1 BLOQUEIA — T4:** badge ativo contraste 1,217:1 (`StepSlot.tsx:215/:217`); corrigir AA.
- **P2 MELHORAR — T4:** no-scrollbar ausente (`:188`), foco recortado e datas parcialmente enquadradas (`:202`).
- **OK:** swipe alcança último dia; Hub/topo inteiro; sem overflow global, 375/1280 claro/escuro.
- **Prova:** novos 4/4 Playwright falham; aguardam commit do autor. Screenshots e matriz em PROGRESSO.md.
- **Próximo MVP:** checkpoint revisável login/painel CRUD de T2/T4 e ativação real de Trilha/T1; fake não é produção.

## Regressão T3 `a134216`

- **OK:** preview 6/6; booking 18/20 inicialmente, 2/2 repetição; onboarding com rascunho/reload sem erro de hidratação.
- **OK:** E2E fake comprova estado pendente antes do webhook e confirmado depois (1/1 repetição).
- **P2 MELHORAR — T3/T4 ambiente:** timeouts e reset inicial sob concorrência; causa não estabelecida, não reproduzidos isoladamente. Evidências em `docs/PROGRESSO.md`.
- Bloqueios anteriores do MVP não encerrados por esta regressão.


## Revalidação final T3 — `e8875b4`

- **OK / P1 encerrado — T4:** pagamento tardio não confirma reserva expirada (`StepPayment.tsx:43/:67`). Regressão QA `booking-ui.spec.ts:160` passou.
- **Provas T3:** 19/19 booking, 6/6 preview, 8/8 E2E com API/Postgres/webhook reais e gateway fake. Evidências e limites em `docs/PROGRESSO.md`.
- **P0 permanece:** gateway bancário e painel/integração na base auditada. **P1:** build padrão e SMTP real sem prova. **P2:** CTAs preview e servidor supervisionado da suíte visual.

## Rodada T3 — 2026-10-03 (histórico)

- **P1 BLOQUEIA — T4:** em `17e52d3`, `StepPayment.tsx:43/:67` confirma por `payment.paid` mesmo quando reserva está `expired`. Pagamento tardio não pode reabrir horário (`CONTRATOS.md:146`). Regresso em `tests/qa/booking-ui.spec.ts:160`; pedido enviado por Maestri.
- **Encerrado em `17e52d3`:** expiração apenas pelo relógio local; dois testes focados passaram, incluindo recuperação após 503. Não confundir com nova regressão acima.
- **Encerrados em `b14ae8d`:** teclado de serviços, contraste do valor Pix e reduced-motion. Preview 6/6 passou, incluindo ausência de HTTP externo no percurso observado.
- **OK:** 8/8 E2E com APIs/Postgres/webhook reais, incluindo navegador por ponte entre branches; 25 integrações; lint/tipos e 48 unitários. Booking controlado: 16/17 em `b14ae8d`.
- **P2 permanece:** CTAs fora do preview e integração da suíte visual ao gate após merge autorizado. MVP real mantém pendências de gateway/painel/SMTP/LGPD descritas nos contratos.

Relatório esperado→observado, arquivo:linha e artefatos em `docs/PROGRESSO.md`.

## Revalidação `6f9a53e` — Terminal 3

- **OK / encerrados:** contraste do sinal claro, hero escuro, CTA ≥44px/foco e booking funcional no servidor 3001.
- **Prova:** 4/4 Playwright reexecutados pelo QA passaram em 40,1s; 21 combinações de rota/largura e fluxo completo sem requests `/api/`.
- **P2 permanece:** CTAs de hero/preços saem do preview para onboarding.
- **MVP real:** bloqueios anteriores continuam ativos. Aprovação restrita ao escopo dos quatro cenários do preview; integração/merge pelo humano.

## Direção visual `5da19df` — Terminal 3 (histórico; achados encerrados em `6f9a53e`)

- **P1 / BLOQUEIA — Terminal 4:** contraste do sinal no booking claro **1,22:1**, exigido ≥4,5:1 (`components/booking/StepService.tsx:72`, `app/globals.css:10`). Revisar texto financeiro após alteração de primary para lima.
- **P1 / BLOQUEIA — Terminal 4:** hero escuro **1,01:1**, exigido ≥3:1 (`components/landing/LandingHero.tsx:28`). Corrigir texto fixo escuro e revisar cores por tema.
- **P2 / MELHORAR — Terminal 4:** CTA do header com 36px, ampliar a ≥44px (`app/preview/landing/page.tsx:56`).
- **P1 / BLOQUEIA validação — Terminal 4/ambiente:** booking ainda falha serviço→horário em 3001; erro WebSocket HMR persiste. Investigar causa antes de atribuir regressão ao código.
- **OK:** responsividade de sete rotas em 375/768/1280px. Artefatos e medições em `docs/PROGRESSO.md`.

- **Encerrado em `6f9a53e`:** bloqueio de validação serviço→horário no servidor 3001. Histórico das falhas HMR preservado em `docs/PROGRESSO.md`; fluxo completo agora passou.

## Revalidação Preview `4a5ee03` — Terminal 3

- **OK / encerrados no preview:** disponibilidade local, consulta Pix local, overflow da landing a 375px e fuso/duração dos slots.
- Provas: 2 Playwright passaram (21 combinações de rota/largura + fluxo completo sem requests `/api/`); lint/tipos e 61 unitários do snapshot passaram. Build padrão não reproduzível no snapshot devido ao symlink de dependências; isso não constitui defeito do preview.
- **P2 pendente — Terminal 4:** CTAs do hero/preços ainda saem do preview para onboarding, conforme achado anterior.
- Bloqueios do MVP real continuam ativos; aprovação desta rodada é restrita às quatro correções do preview. Evidências em `docs/PROGRESSO.md`.

## Preview `6753e06` — QA Terminal 3 (histórico; correções revalidadas acima)

- **P1 / BLOQUEIA — Terminal 4:** booking preview preso nos horários; `PreviewBookingFlow.tsx:150` usa disponibilidade HTTP real (`StepSlot.tsx:93/:119`). Prover horários locais sem banco/API e repetir `tests/qa/preview.spec.ts`.
- **P1 / BLOQUEIA — Terminal 4:** pagamento preview também aciona consulta HTTP real (`PreviewBookingFlow.tsx:179`, `StepPayment.tsx:64`); status deve ser local neste contexto.
- **P1 / BLOQUEIA — Terminal 4:** overflow reproduzido em `/preview/landing` a 375px; revisar cabeçalho (`app/preview/landing/page.tsx:17`) e largura de toda a página.
- **P2 / MELHORAR — Terminal 4:** horários mock usam UTC como hora local e duração fixa de 60min (`lib/preview/mock-data.ts:79`); respeitar São Paulo e duração do serviço.
- **P2 / MELHORAR — Terminal 4:** CTAs reutilizados da landing saem do preview para onboarding (`LandingHero.tsx:32`, `LandingPricing.tsx:63`).

61 unitários, lint e tipos da entrega reproduzidos; aprovação funcional do preview bloqueada. Detalhes em `docs/PROGRESSO.md`.

## Auditoria Terminal 3 — 2026-10-02

Evidências, arquivo/linha, impacto e correção em `docs/PROGRESSO.md`. A pré-condição de integração ainda não foi atendida.

- **P0 / BLOQUEIA — Terminal 1:** Pix real ausente (`lib/payments/index.ts:6`); implementar gateway e validar reconciliação, dinheiro e webhook antes de aceitar pagamentos reais.
- **P0 / BLOQUEIA — Terminais 2 + 1:** dashboard e APIs do dono ausentes (`docs/CONTRATOS.md:70`); entregar fluxo e autorização HTTP por tenant.
- **P0 / BLOQUEIA — Terminal 4 + humano:** integrar booking público (`docs/CONTRATOS.md:69`); rota ainda ausente nesta base. Merge pelo humano.
- **P1 / BLOQUEIA — Terminal 4:** em `feat/booking-ui`, `components/booking/StepPayment.tsx:38` declara expiração local e interrompe polling sem confirmar estado no servidor; reproduzir e corrigir corrida perto do vencimento.
- **P1 / BLOQUEIA validação — Terminal 3/ambiente:** `pnpm build` falha por restrição de porta do Turbopack; build complementar com `--webpack` passou. Repetir comando padrão em ambiente apropriado.
- **P1 / BLOQUEIA validação — Terminal 1/ambiente + Terminal 3:** entrega SMTP real e fluxo login→painel pendentes (`lib/email.ts:14`).
- **P1 — Terminal 3:** após integração, validar fluxo visual real, mobile 375px, desktop, estados, URLs/IDs de tenants e regressões. Os testes HTTP não substituem esta prova.
- **P2 / MELHORAR — Terminal 4:** foco visível do campo Pix (`components/booking/StepPayment.tsx:197` em `feat/booking-ui`).
- **P2 / MELHORAR — Terminal 3:** incorporar suíte visual preexistente ao gate E2E com servidor supervisionado (`tests/qa/playwright.config.ts:12`).

Validado nesta auditoria: 48 unitários e 25 integrações; isolamento de domínio/banco, concorrência, idempotência, webhook inválido/duplicado, centavos e sessão expirada. Resultados E2E finais em `docs/PROGRESSO.md`.

- Terminal 1: antes do gateway real, definir recuperação de cobrança externa em falha de commit e tratamento operacional de pagamento tardio.
- Terminal 1: implementar gateway real atrás de `PaymentProvider` após validação do fluxo fake.
- Humano + terminal 1: definir retenção de histórico financeiro e exclusão de conta conforme LGPD antes de liberar o produto.
- Terminal 3: substituir o teste do esqueleto pelos fluxos reais de agendamento e pagamento conforme as rotas forem entregues.

## Terminal 3 — Testes e QA

- Aguardar o esqueleto no `master` antes de escrever código; depois, ler os contratos de API e pagamento.
- Criar testes Playwright do fluxo de serviço, horário, dados do cliente, sinal por Pix e confirmação, incluindo erros e pagamento pendente.
- Revisar as entregas dos terminais 4 e 5 em mobile de 375px e desktop: acessibilidade, estados de tela, modo escuro e regressão visual.
- Validar landing e onboarding após o fluxo crítico; registrar achados como **bloqueia**, **melhorar** ou **ok**, com arquivo e linha, para o autor corrigir.
- Executar `lint`, `typecheck`, `test` e os testes e2e disponíveis antes de concluir a QA.

## Terminal 3 — Plano de testes Pix (2026-10-02)

- Criar dados isolados no Postgres para exercitar as APIs HTTP reais com Playwright.
- Cobrir reserva, pagamento fake e confirmação por webhook assinado.
- Verificar horário ocupado e duplicação de webhook com persistência e auditoria.
- Documentar execução e validar e2e, lint, typecheck e testes unitários.

## QA T3 `feat/tests` — 2026-10-03

- **OK:** mobile E2E Pix fake confirma apenas após webhook assinado; duplicidade/valor/tenant/segredo público cobertos. 5 E2E + 48 Vitest relacionados passaram; lint/typecheck verdes.
- **P1 BLOQUEIA — T1:** gateway real/chave Pix real ausentes; não existe prova de segredo Pix real em logs. Implementar/revisar provider real antes de cliente pagante; manter secret filtering/log tests no backend.
- **P1 MELHORAR — T2:** reexecutar `tests/qa/dashboard-real.spec.ts` quando servidor de verificação estiver disponível; `127.0.0.1:3342` recusou conexão nesta rodada.
- **Limite de evidência:** UI booking E2E requer `QA_BOOKING_UI_URL`; ausência causou skip. Preview em3001 não substitui rota pública `/{slug}`.
