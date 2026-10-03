# Progresso — auditoria Terminal 3

## Revalidação final T3 — `e8875b4`

**OK / P1 encerrado:** `components/booking/StepPayment.tsx:43/:67` passa a confirmar somente reserva `confirmed`; `expired` prevalece sobre pagamento `paid`. Diff conferido nos caminhos HTTP e callback local. Esperado: dinheiro tardio não reabre horário; observado: tela de expiração, sem falsa confirmação. Regressão em `tests/qa/booking-ui.spec.ts:160` passou, assim como recuperação após 503 e consulta autoritativa no vencimento (`:137/:146`). Terminal 4 realizou a correção; T3 preservou e reexecutou os testes.

- **19/19 booking** passaram (1,2min), incluindo estados e fluxo em 375/768/1280px.
- **6/6 preview** passaram (1,2min): teclado, reduced-motion, contraste dos alvos testados, 21 combinações de rota/largura e fluxo sem HTTP externo ou `/api/` observado.
- **8/8 E2E** passaram (33,8s), executados com `pnpm test:e2e` e `QA_BOOKING_UI_URL=http://127.0.0.1:3001`. APIs, banco e webhook reais; gateway fake e ponte QA entre branches.
- Lint, typecheck, 48 unitários e 25 integrações anteriores permanecem válidos para os mesmos arquivos QA. `git diff --check` passou.

Artefatos: `dogfood-output/audit-2026-10-03-e8875b4-booking-approved/`, `...-preview-approved/`, `...-http-approved/`. Tentativa inicial bloqueada pelo sandbox antes de abrir Chromium; repetição com permissão técnica passou. Build padrão reexecutado e falhou mesmo com permissão técnica: Turbopack não consegue abrir porta interna (`Operation not permitted`) ao processar `app/globals.css:1`. Log: `/tmp/next-panic-fa923fba9706a4666104beb6104bce4.log`. Bloqueia a validação do build; não comprova defeito no CSS. Não declarar build do produto aprovado com base na informação de outro terminal.

**STATUS DO MVP: bloqueado.** P0: gateway bancário e painel autenticado/integração ausentes nesta base auditada. P1: build padrão e login com SMTP real ainda sem prova; falhas de expiração/confirmacão tardia da UI encerradas. P2: CTAs saem do preview e suíte visual requer servidor externo. Próxima ação: T1/T2 concluir integrações e gateway; humano integrar branches; T3 validar ambos os fluxos na versão integrada. Sem push/merge/deploy.

## 2026-10-03 — rodada T3, contratos e evidências reais (histórico)

Worktree confirmado: `/var/home/matheus/projetos/agenda-tests`, branch `feat/tests`, base `d4451f6`; `master` permanece ancestral sem commits novos a integrar. Fetch executado. Branch do produto avaliada: `feat/booking-ui`, inicialmente `6f9a53e`, depois `b14ae8d` e `17e52d3`. Alterações limitadas a QA/documentação; nenhum merge ou edição em worktree de outro terminal.

Skill `autonomous-work` lida e aplicada conforme repasse do humano. Autorização e evidências encaminhadas pelo Maestri ao único agente conectado, Antigravidade, com instrução de repasse aos demais já conectados. Correção de produto permanece com Terminal 4.

### Provas da rodada

| Verificação / estado | Esperado | Observado / evidência |
| --- | --- | --- |
| **OK — lint, tipos, unidade** | Sem warnings/erros | `pnpm lint`, `pnpm typecheck`, `pnpm test`: 48 unitários passaram no worktree QA. |
| **OK — integração** | Isolamento, dinheiro e auth | `pnpm test:db`: 25/25 passaram, incluindo sessão expirada, tenants, concorrência e webhook. |
| **OK — E2E HTTP + navegador** | Reserva persistida e confirmação pelo webhook | 8/8 passaram (28,4s), `QA_BOOKING_UI_URL=http://127.0.0.1:3001`; código em `tests/e2e/booking-pix.spec.ts:91`. Frontend de T4 usa ponte de QA para APIs reais de T1 em 3103; Postgres e HMAC reais, provider fake. Não comprova deployment integrado nem dinheiro bancário. |
| **OK — preview `b14ae8d`** | Fluxo sem API/rede externa, a11y e três larguras | 6/6 passaram (59,3s). Sete rotas × 375/768/1280px; nenhum request HTTP externo observado; nenhum `/api/` no booking, inclusive polling e consulta manual. Teclado de serviços/Enter, reduced-motion, contraste do sinal/hero/valor Pix e foco do CTA passaram nos elementos testados. |
| **Parcial — booking `b14ae8d`** | Todos os estados e regressões passam | 16/17 passaram (55,8s). Falhou confirmação perto de expiração local. Loading/erro/vazio/recuperação, máscara +55, conflito, copia-e-cola, polling, contraste CTA e fluxo em 375/768/1280px passaram. Respostas controladas da API nesta suíte; não confundir com E2E real acima. |
| **OK — correção `17e52d3`, teste focado** | Consulta servidor e recupera falha ao vencer | Dois cenários passaram: confirmação antes de expirar e recuperação depois de 503. |
| **BLOQUEIA — regressão `17e52d3`** | Reserva expirada permanece expirada mesmo com dinheiro recebido | Novo cenário falhou: `status: expired` + `payment.status: paid` mostra “Horário confirmado!”. Contrato `docs/CONTRATOS.md:146` determina que pagamento tardio não reabre horário. |

### Achados atuais por responsável

| Classe | Arquivo:linha | Esperado → observado; impacto | Ação |
| --- | --- | --- | --- |
| **BLOQUEIA / P1 — T4** | `components/booking/StepPayment.tsx:43` e `:67` em `17e52d3` | Confirmação depende da reserva → `payment.paid` também confirma. Cliente recebe confirmação de horário já liberado, podendo conflitar com outra reserva. | Confirmar só quando `booking.status === confirmed`, nos caminhos HTTP e callback local. Preservar vencimento autoritativo e recuperação após falha. Teste `tests/qa/booking-ui.spec.ts:160`; pedido Maestri enviado. |
| **MELHORAR / P2 — T4** | `components/landing/LandingHero.tsx:44`, `LandingPricing.tsx:65/:121` | Preview deve permanecer local → CTAs vão a onboarding. Ao seguir esses links, usuário sai do escopo sem backend. | Adaptar destinos no preview, preservando landing real. Achado estático já aberto. |
| **MELHORAR / P2 — T3 + humano** | `tests/qa/playwright.config.ts:12` | Gate reproduzível integrado → testes visuais dependem de servidor externo. | Após merge autorizado, ligar a suíte ao servidor integrado supervisionado. Hoje a variável de URL permite auditar branches sem alterar produto. |
| **OK — T4** | `StepService.tsx:72`, `LandingHero.tsx:28`, `StepPayment.tsx:167` em `b14ae8d` | Contraste AA/teclado → elementos testados passaram; falhas de `6f9a53e` encerradas em `b14ae8d`. | Preservar regressões em Playwright. |
| **OK — backend** | `tests/e2e/booking-pix.spec.ts:123/:140/:168` | Token, ID, payload, valor, assinatura e duplicação protegidos → cenários HTTP reais passaram sem alterar indevidamente a reserva. | Preservar testes. |

A origem 3001 estava inicialmente indisponível (`ERR_CONNECTION_REFUSED`). Provas de `6f9a53e` também foram feitas em snapshot isolado, sem `.env`, em 3104; o serviço voltou a ficar disponível em `b14ae8d`. Não tratar falha de conexão como defeito da interface. Corrigida uma expectativa excessiva de QA: reduced-motion aceita duração zero ou ≤1ms, não exige uma representação CSS específica.

Artefatos da rodada: `dogfood-output/audit-2026-10-03-b14ae8d-preview/`, `...-b14ae8d-booking/`, `...-http-real/` e `...-17e52d3-expiry/`. Traces e screenshots dos casos que falharam foram preservados. Observação de rede cobre requests HTTP do navegador nas rotas/percurso exercitados; não prova rede do build ou chamadas internas do servidor. Contraste é verificado por alvo, não por varredura de toda a aplicação.

MVP real continua sem aprovação: Pix bancário ausente, dashboard autenticado não integrado nesta base e política de exclusão/retenção pendente conforme contratos. Build padrão não reexecutado nesta rodada de T3; limitação anterior do ambiente de QA não equivale à declaração de sucesso do build do produto. Próxima ação: T4 corrigir a regressão tardia e T3 executar gates focados finais. Merge/push/deploy não realizados.

## 2026-10-02 — revalidação `6f9a53e`: OK no escopo testado do Preview

Commit conferido em `feat/booking-ui`: `6f9a53e`. Reexecução independente pelo Terminal 3 contra `http://127.0.0.1:3001`, usando os testes de QA existentes, sem modificar código de produto.

**4/4 Playwright passaram em 40,1s:**

- Contraste do sinal no booking claro (1,7s): ≥4,5:1.
- Contraste do hero escuro, CTA mobile ≥44px e foco visível (1,9s).
- Hub + seis telas em 375/768/1280px (28,5s): 21 combinações, HTTP 200 e sem overflow.
- Booking completo sem requests `/api/` (7,2s): serviço → horário → dados → Pix → confirmação; inclui consulta manual e polling local antes da simulação.

**Encerrados:** contraste do sinal, contraste do hero escuro, alvo de toque do CTA e bloqueio funcional de avanço para horários no servidor 3001. Diff confirma ajustes de cores, CTA, estabilização da fonte de disponibilidade em `StepSlot` e callback do preview. A checagem funcional passou no servidor informado; não foi feita auditoria independente de todos os eventos HMR.

Comando reproduzido: `PREVIEW_BASE_URL=http://127.0.0.1:3001 node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts --output dogfood-output/revalidation-6f9a53e`. Screenshots da interface clara/escura em `dogfood-output/revalidation-6f9a53e/`.

Gates anteriores do worktree QA (lint, typecheck e 48 unitários) continuam válidos: nenhum teste/configuração/código foi alterado nesta rodada. Build e 61 unitários do commit de produto não foram reexecutados nesta rodada. Passar quatro cenários não equivale a auditoria de toda a interface ou aprovação do MVP real.

**P2 ainda pendente:** CTAs do hero/preços do preview levam a onboarding. **MVP real continua bloqueado:** gateway real, dashboard autenticado, integração e provas de fluxo real/SMTP/segurança permanecem conforme auditoria. Próxima ação: humano avaliar integração da entrega; merge permanece com o humano.

## 2026-10-02 — direção visual `5da19df`: NÃO APROVADA (histórico; achados encerrados em `6f9a53e`)

Revalidação no servidor 3001 informado pelo Terminal 4. A referência visual original não foi disponibilizada ao QA; fidelidade à referência não foi avaliada. Foram avaliadas responsividade, interação e requisitos objetivos de acessibilidade.

| Classificação | Arquivo e linha em `5da19df` | Evidência / impacto | Correção / responsável |
| --- | --- | --- | --- |
| **BLOQUEIA / P1** | `components/booking/StepService.tsx:72`, token em `app/globals.css:10` | Sinal usa lima como texto sobre fundo claro; contraste medido **1,2166:1**, mínimo AA 4,5:1. Informação financeira pouco legível no booking. | Terminal 4: usar cor semântica legível para texto financeiro e revisar os demais usos de `text-primary` após troca global de token; preservar lima nos botões com texto escuro. |
| **BLOQUEIA / P1** | `components/landing/LandingHero.tsx:28`, fundo escuro em `app/globals.css:29` | Título mantém `#111613` sobre fundo `#0e1612`; contraste medido **1,0051:1**, mínimo 3:1 para título grande. Screenshot confirma título quase invisível. | Terminal 4: tokens de foreground adequados por tema e revisar cores fixas nas demais seções. |
| **MELHORAR / P2** | `app/preview/landing/page.tsx:56` | CTA “Testar Booking” com **36px** de altura a 375px; requisito do projeto é ≥44px. | Terminal 4: ampliar alvo de toque mantendo cabeçalho sem overflow. |
| **BLOQUEIA validação / P1** | `tests/qa/preview.spec.ts:23` (evidência; causa no servidor ainda não localizada) | Booking continua sem avançar serviço→horário em 3001; trace repete `ERR_INVALID_HTTP_RESPONSE` no WebSocket HMR. | Terminal 4/ambiente: investigar servidor/proxy/hidratação e repetir interação. Não atribuir causalidade ao HMR sem prova adicional. |
| **OK** | `tests/qa/preview.spec.ts:3` | Sete rotas, três larguras: 21 combinações responderam 200 e sem overflow. | Preservar cobertura. |

Resultados Playwright: responsividade **passou**, booking **falhou**, dois cenários de acessibilidade **falharam**. O foco do CTA do header passou na checagem executada; isso não valida foco em todos os elementos.

Artefatos: `dogfood-output/visual-5da19df/` e `dogfood-output/visual-5da19df-a11y/`, com screenshots, contextos e traces. Contraste calculado a partir de estilos computados, convertendo cores pelo canvas e compondo transparência dos fundos ancestrais. Valores medidos sobre o sinal de R$25 e o elemento h1; não foi feita auditoria automática de contraste de toda a página.

Testes novos em `tests/qa/preview-visual.spec.ts`; seleção pela configuração do preview. Execução: `PREVIEW_BASE_URL=http://127.0.0.1:3001 node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts`. Código de produto não alterado. Gates relatados pelo Terminal 4 para `5da19df` (61 unitários/build) não foram reproduzidos nesta rodada; resultados anteriores não aprovam esta nova interface. Gates do worktree QA: lint sem warnings, typecheck e 48 unitários passaram; `git diff --check` passou.

## 2026-10-02 — servidor compartilhado em 3001 (histórico; fluxo revalidado em `6f9a53e`)

Alvo informado: `http://127.0.0.1:3001/preview`. Testes configuráveis por `PREVIEW_BASE_URL`, sem alterar o servidor/worktree do Terminal 4.

- **OK:** hub e seis telas responderam 200; 21 combinações de rota/largura (375/768/1280px) sem overflow.
- **BLOQUEIA validação / P1 — Terminal 4/ambiente:** fluxo booking não completou no servidor 3001. Primeira execução sofreu navegação/reset ao passo de serviço e timeout. Repetição com seletor restrito a `radiogroup "Horários disponíveis"` falhou em 10s: depois de clicar “Continuar para escolher horário”, snapshot permanece em “Escolha o serviço”. Trace registra repetidas falhas de handshake `ws://127.0.0.1:3001/_next/hmr` com `net::ERR_INVALID_HTTP_RESPONSE`. Relação causal com reset/clique ainda não comprovada; investigar servidor/proxy/HMR/hidratação antes de atribuir defeito à implementação.
- Evidência: `tests/qa/preview.spec.ts:23`, `dogfood-output/server3001-recheck/preview-preview-booking-funciona-sem-chamadas-de-backend/trace.zip` e `error-context.md`.
- **Pendente:** responsável disponibilizar servidor com interação estável e repetir somente booking. A aprovação do commit `4a5ee03` na cópia isolada permanece como evidência separada; não comprova o funcionamento deste servidor.

Execução: `PREVIEW_BASE_URL=http://127.0.0.1:3001 node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts`. Resultado inicial: 1 passou / 1 falhou. Repetição focada do booking: 1 falhou. Lint, tipos e 48 unitários do worktree QA passaram na rodada.

## 2026-10-02 — revalidação Preview `4a5ee03`

**OK: os quatro achados revalidados foram corrigidos.** Esta conclusão substitui os bloqueios específicos de preview da revisão `6753e06` abaixo. Não aprova o MVP de produção nem encerra achados anteriores sobre o fluxo real.

Snapshot isolado: `/tmp/agenda-preview-qa-4a5ee03`, sem `.env` ou conexão de banco, servidor em 3104 com Webpack. Nenhum arquivo do Terminal 4 foi editado.

| Prova | Resultado |
| --- | --- |
| Playwright `tests/qa/preview.spec.ts` | **2/2 passaram, 57s**: hub + seis telas em 375/768/1280px (21 combinações) e booking completo até confirmação. |
| Ausência de backend no booking | **OK:** nenhum request `/api/` durante seleção de horário, envio, consulta manual, 4,5s de polling e simulação do Pix. |
| Fuso e duração | **OK:** checagem direta de `getMockAvailabilitySlots` confirmou primeiro horário 11:30 em `America/Sao_Paulo` e duração de todos os slots para serviços de 45/60/90min. |
| Lint no snapshot | **OK:** ESLint sem warnings. |
| Tipos no snapshot | **OK:** `next typegen` + `tsc --noEmit`. |
| Unitários no snapshot | **OK:** 8 arquivos / 61 testes. |
| Build padrão no snapshot | **Indisponível como prova:** `pnpm build` recusou node_modules compartilhado por symlink; `next build` também recusou symlink externo ao filesystem root do Turbopack. Limitação da cópia QA, sem evidência de regressão do produto. |
| Build complementar | **OK:** `next build --webpack` compilou, validou tipos e gerou todas as rotas, incluindo as sete de preview, sem `.env` ou banco. |

Correções conferidas: injeção local de disponibilidade em `PreviewBookingFlow`/`StepSlot`, consulta local em `StepPayment`, landing sem overflow e slots UTC correspondentes à hora local com duração do serviço. O teste passou também na consulta manual e polling antes de usar o botão de simulação.

Pendente **P2**, já relatado e fora destas quatro correções: CTAs de hero/preços do preview ainda apontam para `/onboarding` (`components/landing/LandingHero.tsx:32`, `LandingPricing.tsx:63`). Pendentes do produto real: gateway real, dashboard autenticado, integração, expiração autoritativa do Pix, SMTP e auditoria completa do MVP. Próxima ação: humano pode avaliar integração das correções de preview; merge permanece responsabilidade do humano.

## 2026-10-02 — revisão do Preview do Terminal 4 (histórico, substituída pela revalidação acima)

Entrega inspecionada: `feat/booking-ui`, commit `6753e06`. Executada em snapshot isolado `/tmp/agenda-preview-qa-6753e06`, sem `.env`, banco configurado ou alteração no worktree do Terminal 4. Servidor Next com Webpack em 3104. Esta prova avalia o preview e não muda o status do MVP real abaixo.

- **OK:** 8 arquivos / 61 unitários reproduzidos; ESLint sem warnings; `next typegen` e `tsc --noEmit` passaram no snapshot.
- **OK parcial:** hub e seis telas responderam 200 e exibiram o indicador preview nas 21 combinações de rota/largura (375, 768 e 1280px). Único overflow detectado: landing a 375px. Esta verificação não testa ações de dashboard/reservas/configurações.
- **BLOQUEIA / P1 — Terminal 4:** `components/preview/PreviewBookingFlow.tsx:150` usa `StepSlot` sem dados locais. `components/booking/StepSlot.tsx:93` e `:119` consultam `/api/public/studio-bella/availability` com serviço `srv-corte-fem`, incompatível com o contrato UUID. No navegador sem configuração externa, avançar para horários não apresenta radios e impede o fluxo. Correção: fornecer disponibilidade local no caminho do preview, preservando a fonte HTTP do fluxo real. Teste: `tests/qa/preview.spec.ts:15`.
- **BLOQUEIA / P1 — Terminal 4:** `components/preview/PreviewBookingFlow.tsx:179` também usa `StepPayment` que consulta backend em `components/booking/StepPayment.tsx:64`; o atalho local não elimina polling remoto. Achado estático; passo Pix não alcançado sem contornar o bloqueio anterior. Correção: consulta de status local no preview, sem interceptar APIs de produção globalmente.
- **BLOQUEIA / P1 — Terminal 4:** `/preview/landing` tem overflow horizontal a 375px, reproduzido em Playwright. `app/preview/landing/page.tsx:17` mantém marca e duas ações na mesma linha; revisar responsividade do cabeçalho e confirmar ausência de overflow da página inteira. Teste: `tests/qa/preview.spec.ts:3`; trace em `dogfood-output/playwright/`.
- **MELHORAR / P2 — Terminal 4:** `lib/preview/mock-data.ts:79` escreve horários locais como UTC: 11:30Z aparece como 08:30 em São Paulo, antes da abertura de 09h. Todos os slots têm 60 minutos, inclusive serviços de 45/90 minutos. Correção: gerar instantes no fuso declarado e fim conforme serviço; testar horário de abertura e duração. Inspeção estática.
- **MELHORAR / P2 — Terminal 4:** `components/landing/LandingHero.tsx:32` e `LandingPricing.tsx:63` levam a `/onboarding`, saindo do preview apesar do header adaptado. Correção: destinos apropriados no contexto preview; manter destinos atuais da landing real.

QA adicionou `tests/qa/preview.spec.ts` e configuração dedicada. Execução: iniciar snapshot da entrega em 3104 e executar `node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts`. Nenhum mock de rede é usado: o teste deve detectar dependências de backend. Dois cenários falharam: fluxo sem backend e responsividade da landing. A repetição de responsividade completou todas as 21 combinações e confirmou só o overflow da landing a 375px. Gates do worktree QA após adicionar os testes: lint, typecheck e 48 unitários passaram. Preview não aprovado até corrigir os bloqueios; build relatado pelo Terminal 4 ainda não foi reproduzido por QA nesta entrega.

## 2026-10-02 — STATUS DO MVP: BLOQUEADO

Base auditada: `feat/tests`, commit inicial `d4451f6`, sobre `master` (`main` não existe). Fetch executado e rebase sobre master sem alterações. Auditoria realizada antes da conclusão da pré-condição: dashboard ausente; booking público existe em `feat/booking-ui` (`1a03453`), mas não está integrado nesta base. Nenhum merge realizado. Este arquivo não existia e foi criado nesta auditoria.

### Gates e evidências

| Ordem | Verificação | Resultado |
| --- | --- | --- |
| 1 | `pnpm build` | BLOQUEIA validação: Turbopack falha em `app/globals.css`, ao abrir porta interna (`Operation not permitted`), inclusive após repetição autorizada. `pnpm build --webpack` passou como prova complementar; comando padrão continua pendente. |
| 2 | `pnpm lint` | OK, sem warnings do ESLint. |
| 3 | `pnpm typecheck` | OK. |
| 4 | `pnpm test` | OK: 48 testes, 5 arquivos. |
| 5 | `pnpm test:db` | OK: 25 testes, 3 arquivos. Primeiro falhou por Postgres parado; `pnpm db:up` e `pnpm db:migrate` resolveram a infraestrutura. |
| 6 | `pnpm test:e2e` | OK: 7 testes passaram (21,3s), cinco cenários HTTP reais e dois do esqueleto/autenticação. Uma expectativa de QA foi corrigida: slug inexistente retorna `business_not_found`. Não comprovam o booking visual. |
| 7 | Autenticação | OK: link mágico de uso único, token armazenado como hash, sessão válida/ausente/expirada. Envio SMTP é mockado na integração; entrega real de email não validada. |
| 8 | Tenants | OK no domínio/banco: dono A não lê B; referências cruzadas rejeitadas; cobrança/evento de A não altera B. Autorização HTTP do painel pendente por ausência das rotas. |
| 9 | Reservas | OK na integração: disputa concorrente, exclusão de sobreposição no Postgres, idempotência, sinal zero e rollback do provider. |
| 10 | Pix | OK somente fake: centavos, QR não pagável e token de consulta. BLOQUEIA cobrança real. |
| 11 | Webhooks | OK na integração: HMAC inválido, valor divergente, duplicação simultânea, conflito de evento, rollback e pagamento tardio sem reocupar horário. |
| 12 | Dashboard | BLOQUEIA: telas e APIs do proprietário ausentes na base auditada. |
| 13 | Booking público | BLOQUEIA integração: rota `/[slug]` ausente na base auditada. Inspeção estática separada da branch do Terminal 4. |
| 14 | Mobile | Esqueleto validado a 375px. Booking/dashboard, desktop, contraste e regressão visual pendentes na versão integrada. |
| 15 | Estados | Estados do domínio exercitados. Loading/erro/vazio/sucesso das telas principais não validados nesta base. |
| 16 | Regressões | Gates disponíveis executados; regressão visual e fluxo completo com pagamento real pendentes. |

### Achados e responsáveis

| Classe / prioridade | Arquivo e linha | Problema e impacto | Correção necessária / responsável |
| --- | --- | --- | --- |
| BLOQUEIA / P0 | `lib/payments/index.ts:6` | Somente fake; produção rejeita cobrança. Cliente não consegue pagar sinal real. | Terminal 1: gateway real, webhook autenticado, reconciliação e prova sandbox antes de cobrança real. |
| BLOQUEIA / P0 | `docs/CONTRATOS.md:70` | Dashboard e APIs previstas, ausentes no inventário de rotas do build. Proprietário não administra agenda/serviços/configuração. | Terminais 2 e 1: entregar telas e APIs autorizadas por sessão e tenant; Terminal 3 testa acesso cruzado pelo HTTP. |
| BLOQUEIA / P0 | `docs/CONTRATOS.md:69` | `/[slug]` não integrada; fluxo do cliente não começa pela interface na base auditada. | Terminal 4 + humano: integrar entrega revisada; Terminal 3 testa navegador contra APIs reais. |
| BLOQUEIA / P1 | `app/globals.css:1` (entrada reportada pelo Turbopack) | Build padrão falha por permissão de porta interna; causa ambiental, sem evidência de defeito no CSS. | Terminal 3/ambiente: repetir `pnpm build` em ambiente com permissão; não mudar CSS para mascarar erro. Webpack passou. |
| BLOQUEIA / P1 | `components/booking/StepPayment.tsx:38` **em feat/booking-ui** | Relógio local marca expiração e para polling em `:92` sem consultar estado autoritativo; pagamento confirmado perto do vencimento pode aparecer expirado. Achado estático, reprodução pendente. | Terminal 4: consultar servidor antes de declarar expiração; manter recuperação se consulta falhar. Reproduzir com teste de relógio já presente em `tests/qa/booking-ui.spec.ts`. |
| MELHORAR / P2 | `components/booking/StepPayment.tsx:197` **em feat/booking-ui** | Campo Pix remove outline sem foco substituto explícito. Navegação de teclado perde indicação de foco. Achado estático. | Terminal 4: estilo focus-visible contrastante e validação no navegador. |
| MELHORAR / P2 | `tests/qa/playwright.config.ts:12` | Suíte visual preexistente não versionada depende de servidor externo em 3104; não é executada por `pnpm test:e2e`. | Terminal 3: incorporar suíte depois de integrar booking, com servidor supervisionado e dados reais; mocks ficam para estados de erro. |
| BLOQUEIA / P1 | `lib/email.ts:14` | Entrega SMTP real não foi exercitada; login completo do dono não comprovado. Não há evidência de defeito na função. | Terminal 1/ambiente: configurar SMTP de teste e verificar entrega/consumo do link no navegador. |
| OK | `tests/integration/database.test.ts:65` | Query por dono e referências entre tenants exercitadas com Postgres. | Preservar testes; complementar HTTP quando painel existir. |
| OK | `tests/integration/pix.test.ts:133` | Webhook simultâneo produz um efeito e duas entregas auditadas. | Preservar teste ao adicionar gateway. |
| OK | `tests/integration/auth.test.ts:58` | Sessão expirada retorna ausência de sessão. | Cobertura adicionada pelo Terminal 3. |

### Mudanças de QA

- Ampliado `tests/e2e/booking-pix.spec.ts`: token ausente/inválido, ID/slug manipulados, preço injetado, UUID inválido, dados inválidos, assinatura inválida e valor divergente sem confirmação.
- Ampliado `tests/integration/auth.test.ts`: sessão válida, ausência de sessão e expiração persistida no banco.
- Arquivos preexistentes não versionados em `tests/qa/` e `dogfood-output/` preservados; artefatos anteriores não usados como evidência de aprovação desta execução.

### Como reproduzir e próxima ação

Com `.env` local configurado: `pnpm db:up`, `pnpm db:migrate`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`. A simulação exige segredos locais exclusivos; não usar valores fictícios da `.env.example` como credenciais finais.

Próxima ação: terminais 1/2/4 concluir e integrar as partes principais; humano faz os merges autorizados. Depois Terminal 3 repete auditoria completa, mobile/desktop e ambos os fluxos pelo navegador. Não solicitar revisão a terminal desconectado. Não há aprovação para primeiro cliente pagante.
