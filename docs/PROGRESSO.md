# Progresso — auditoria Terminal 3

## Revalidação final da régua — `6d12ccf`

Servidor/worktree T4 confirmado em `6d12ccf`. **4/4 Playwright passaram em 15,4s**, Corte + escova/Horário em 375/1280, claro/escuro. Foco de todos os dias plenamente enquadrado após Tab; nenhum outline recortado (`focusClips=[]`). No início fade esquerdo invisível/direito visível; no fim direito invisível/esquerdo visível, inclusive após swipe. Screenshot do último dia confirma texto e anel íntegros.

Preservados: scrollbar nativa computada `none`, badge ativo **10,6386:1**, ArrowRight/ArrowLeft rolam a régua, touch alcança extremo, topo/Hub íntegros e página sem overflow horizontal. **P2 de foco/enquadramento e fade persistente encerrados** no escopo exercitado. Diff usa listener de scroll e window resize; não possui ResizeObserver, apesar da descrição recebida. Comportamento esperado nos viewports testados foi validado; não exigir implementação específica.

Teste `tests/qa/slot-ruler.spec.ts` adaptado aos dois fades e verifica suas opacidades nos extremos. Medição aguarda enquadramento do outline completo, evitando observar quadro intermediário da rolagem. Gates QA: lint sem warnings, typecheck, 48/48 unitários e diff-check passaram. Nenhuma alteração de frontend/backend.

Comando: `PREVIEW_BASE_URL=http://127.0.0.1:3001 node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts --grep 'régua Corte' --output dogfood-output/slot-ruler-6d12ccf`. Screenshots `initial.png` e `last-day-focus.png` nos quatro diretórios de viewport/tema. Aprovação restrita à régua; não altera pendências de gateway bancário, ativação real, auth/produção e integração descritas na matriz do MVP. Sem merge/push.


## 2026-10-03 — painel T2 integrado `c16fadd`

Entrega recebida: `c16faddb5fdbf3db176b8bd33a3b7c9881c001df`, `feat/dashboard`; servidor Next de produção em 3342, PostgreSQL sintético exclusivo de verificação em 55442, SMTP local em 25242. Worktree T2 passou para `99d15bc`, diferença somente documental; comportamento de produto corresponde a `c16fadd`. T3 não editou T2, não integrou `f54803f`, não interrompeu infraestrutura compartilhada e não revisou novamente o log sensível.

Suíte versionada no worktree T3: `tests/qa/dashboard-real.spec.ts` e `dashboard.config.ts`. Lê fixture/env privados de `/tmp/agenda-t2-final` (ou `QA_DASHBOARD_FIXTURES`), sem imprimir credenciais/cookies/tokens. Login feito pelo formulário e link entregue por SMTP; contexto HTTP do navegador consome link, sem fabricar sessão. Trace/vídeo/screenshot automático desativados nas etapas de autenticação. Screenshots explícitos somente de páginas do painel com dados sintéticos. Mutações usam negócios temporários próprios ligados ao dono da fixture, e tenant alheio temporário; cleanup limitado aos registros criados pela suíte. Agenda da fixture é somente lida.

Comando: `node node_modules/@playwright/test/cli.js test --config tests/qa/dashboard.config.ts --output dogfood-output/dashboard-c16fadd-verified`. **1/1 passou em 7,3s**. Lint/tipos, 48 unitários do worktree QA e `git diff --check` passaram. Build T2 e seus 73 unitários/3 DB são provas fornecidas por T2, não reexecutadas por T3. Não repetir auditoria completa por alterações somente documentais.

| Rota / mecanismo | Commit / natureza | Check / prova |
| --- | --- | --- |
| `/dashboard/login`, Better Auth | `c16fadd`, SMTP e banco reais locais | Email entregue, link consumido cria sessão; tentativa de reutilização é rejeitada por erro ou limite de tentativas. Sem bypass. |
| `/dashboard`, `view=week` | `c16fadd`, Server Component/Drizzle reais | Dono acessa agenda com data da fixture; Semana selecionada, sete seções diárias; mobile/desktop sem overflow. |
| `/dashboard/services`, `saveService` | `c16fadd`, Server Action/Postgres reais | Estado vazio, sinal maior que preço rejeitado, criação com feedback; preço 80,35 vira 8035 e sinal 20,15 vira 2015; edição 85,90 vira 8590; reload conserva dados. |
| `/dashboard/services`, isolamento | `c16fadd`, sessão/ação reais | BusinessId alheio no formulário retorna erro sem alterar serviço; URL alheia mostra indisponível e remove formulário. Contexto anônimo redireciona para login. |
| `/dashboard/settings`, `saveHours` | `c16fadd`, Server Action/Postgres reais | Segunda 09:30–17:30 salva com feedback; banco contém apenas esse dia; reload conserva abertura. |
| `/dashboard/customers` | `c16fadd`, leitura real | Página abre nas duas larguras sem overflow. Esta suíte não exercita edição de cliente, ausente no contrato. |

### Classificação

- **OK**, `app/dashboard/(owner)/actions.ts:15/:28`, `lib/dashboard/session.ts:7`: sessão real, validação monetária, gravações de serviços/horários e proteção da tentativa tenant exercitada.
- **OK**, `components/dashboard/forms.tsx:18/:41`: vazio, erro de validação, feedback de sucesso e reload exercitados. Loading/erro de infraestrutura não foram provocados na infraestrutura compartilhada; não afirmar cobertura desses estados por esta suíte.
- **OK**, `app/dashboard/(owner)/page.tsx`: agenda semanal com sete dias; quatro rotas em 375/1280 passaram sem overflow.
- **Limitação de prova**, `lib/auth.ts`: produção ainda depende de revisão/correção de autenticação preexistente informada por T2/T1. Login SMTP sintético local passou; isso não encerra risco de auth em produção nem comprova entrega real a cliente.

Primeira tentativa parou ao manipular tenant: o teste alterou campo oculto antes de mudar nome, React restaurou o valor no rerender. Corrigida ordem de manipulação em tests/, sem achado de produto. Nova execução passou. Repetição para screenshots atingiu HTTP 429 no verify; aguardada janela normal, sem desativar ou contornar limite. Versão final passou. A rejeição por replay pode ocorrer pelo limite: prova específica de uso único do token permanece também nos testes de integração anteriores.

Artefatos: `dogfood-output/dashboard-c16fadd-verified/`, oito screenshots de agenda/serviços/clientes/funcionamento em 375/1280. Nenhum novo BLOQUEIA de painel reproduzido neste escopo. Contrato não oferece exclusão de serviço, edição de cliente, cadastro do negócio nem alteração de reserva; não declarar CRUD completo do produto. Próxima ação: T4 coordenar integração visual do painel, T1/Trilha entregar ativação real; T3 validar fluxo integrado quando houver checkpoint. Sem merge/push. Correções da régua e riscos de produção permanecem conforme seção anterior.


## Revalidação T4 `0c6b39c` — régua

Servidor/worktree confirmado em `0c6b39c`. Quatro cenários em 375/1280 claro/escuro: scrollbar computada `none`, badge ativo **10,6386:1**, ArrowRight aumenta scrollLeft e ArrowLeft retorna, swipe alcança último dia, gradiente de 32px renderizado e não intercepta eventos. **P1 contraste encerrado**, scrollbar corrigida.

**P2 permanece — T4**, `components/booking/StepSlot.tsx:192/:209`: Tab dá foco a todos os dias, mas dia intermediário permanece parcialmente visível; outline recortado nos extremos. **P2 — T4**, `:191`: fade fixo continua no extremo final, cobre texto/foco do último dia e indica continuação inexistente. Correção necessária: enquadrar botão/foco e condicionar fade à existência de datas ocultas naquele lado. Quatro testes continuam falhando exclusivamente nos checks de enquadramento/foco; não declarar régua integralmente aprovada.

Prova: `dogfood-output/slot-ruler-0c6b39c/`, screenshots `initial.png` e `last-day-focus.png`, trace/contexto nos quatro diretórios. Gates QA lint/tipos e 48 unitários passaram. Teste adaptado ao novo `role=group` e ampliado para setas/gradiente; nenhum produto alterado.


## 2026-10-03 — régua Corte + escova e checkpoint MVP

Plano executado: reproduzir a evidência humana na etapa Horário, medir contraste/foco/rolagem e enviar achados ao autor; preservar as provas reais existentes e identificar próximo checkpoint de painel/onboarding. AGENTS.md, backlog, contratos, progresso e `agenda-backend/docs/EQUIPE.md` lidos. Worktree T3 preservada. Servidor 3001: worktree T4 em `a134216`; referência da branch avançou para `2853e3a`, contendo apenas testes/documentação, sem alteração da régua. Não presumir que branch e servidor são o mesmo checkout.

| Rota / commit | Check e natureza | Prova / resultado |
| --- | --- | --- |
| `/preview/booking`, `a134216` | Dados locais; Corte + escova, Horário, 375/1280, claro/escuro | 4/4 cenários falharam nos novos checks; badge, scrollbar e foco detalhados abaixo. Swipe alcança último dia; Hub no topo e ausência de overflow global passaram. |
| `/preview/*`, `a134216` | Dados locais; teclado, contraste dos alvos anteriores, responsividade/rede | Reutilizada prova 6/6 da rodada anterior. Novos checks revelam lacunas na régua; aquela prova não cobria badge/foco. |
| `/[slug]`, `a134216` + backend QA `d4451f6` | Ponte QA, API/Postgres reais, provider fake, webhook HMAC | Prova anterior: pendente antes de webhook; confirmado depois, 1/1 repetição. Nenhuma mudança de comportamento relevante exige repetir agora. |
| `/api/public/*`, webhook | API/Postgres reais, fake | Reutilizadas 8/8 E2E e 25/25 integrações: duplicidade, expiração, assinatura/valor inválidos, isolamento e concorrência. Não equivalem a pagamento bancário. |
| `/onboarding`, `a134216` | UI local, sem ativação real de negócio | Rascunho/reload/teclado sem hidratação passou anteriormente. E2E de ativação depende de endpoint/checkpoint real. |
| `/dashboard/*`, T2 | Implementação ainda não commitada no worktree T2 | Solicitado ao CODEXADO checkpoint e servidor/ações revisáveis; não testar/editar trabalho em andamento sem entrega identificada. |

### Achados enviados ao Antigravidade

- **BLOQUEIA / P1 — T4**, `components/booking/StepSlot.tsx:215/:217`: badge ativo “5 vagas” usa branco sobre lima. Esperado AA ≥4,5:1; medido **1,216935731:1** nos quatro cenários, com composição alfa pelo canvas. Impacto: disponibilidade ilegível. Correção: tokens semânticos com contraste adequado no badge ativo.
- **MELHORAR / P2 — T4**, `StepSlot.tsx:188`, `app/globals.css`: `no-scrollbar` não tem definição. Computed `scrollbarWidth=auto`, pseudo scrollbar sem `display:none`; imagem humana mostra barra clássica branca no escuro. Chromium headless usa barra sobreposta e não reproduz a faixa branca na screenshot; ausência da regra foi comprovada. Correção: definir a utilidade compatível, preservando rolagem touch/teclado.
- **MELHORAR / P2 — T4**, `StepSlot.tsx:188/:202`: overflow recorta outline de foco nas extremidades. Alguns dias intermediários continuam parcialmente visíveis depois de Tab e espera da rolagem. Todos recebem foco; não afirmar que ficam inacessíveis. Correção: preservar espaço de foco e enquadramento do botão focado no container.
- **OK**, `components/preview/PreviewBookingFlow.tsx:107`: Hub/topo integral com scroll inicial zero nos quatro cenários; corte superior da imagem humana não reproduzido. Não atribuir causa sem evidência.
- **OK**, `StepSlot.tsx:188`: swipe via eventos touch do Chromium alcança extremo final; página inteira sem overflow horizontal.

Reprodução: abrir `/preview/booking`, selecionar Corte + escova, avançar para Horário. Tab percorre régua; swipe horizontal alcança último dia. Teste `tests/qa/slot-ruler.spec.ts` foi incorporado ao config de preview; somente testes/config QA alterados. Comando: `PREVIEW_BASE_URL=http://127.0.0.1:3001 node node_modules/@playwright/test/cli.js test --config tests/qa/preview.config.ts --grep 'régua Corte' --output dogfood-output/slot-ruler-a134216-final`. Resultado esperado atualmente: quatro falhas de regressão, preservadas até correção do autor. Screenshots `initial.png`, `last-day-focus.png`, traces e contexto em cada diretório de viewport/tema.

Gates QA: lint sem warnings, typecheck, 48/48 unitários e diff-check passaram. Checks de navegador novos permanecem vermelhos por achados reais. Correção não aprovada; aguardar novo commit T4 e executar somente regressões afetadas. Sem alteração de frontend/backend, gateway, segredo, merge ou push. T1 `f54803f` não foi revisado novamente. Maestri list executado; T4 e CODEXADO contatados. Coordenador nominal `Codex` rejeitado por nomes duplicados; diagnóstico confirmou transporte funcional. Trilha/Prisma não aparecem na lista conectada de T3, portanto coordenação do funil necessita repasse do coordenador. Pedidos registrados abaixo.


## 2026-10-03 — regressão T3 no servidor 3001 (`a134216`)

Última prova: `e8875b4`. Branch atual `feat/booking-ui`: `a134216`; worktree T3 mantido em `feat/tests`. Diff desde a última prova inclui tokens, navegação preview, onboarding e autenticação local. Backend/log sensível de T1 não foi revisado nesta rodada. Nenhuma alteração de produto, dependência, merge ou push.

**OK:** 6/6 preview passaram (1,4min), incluindo 375/768/1280px, teclado, reduced-motion, contraste dos alvos financeiros e ausência de HTTP externo/API no percurso. Booking controlado passou em 18/20 na primeira execução; os dois cenários falhos passaram em repetição focada (2/2, 9,8s). Estados loading/error/empty/success, recuperação, expiração autoritativa e pagamento tardio foram exercitados. Novo teste `tests/qa/booking-ui.spec.ts:232` restaura rascunho salvo, usa Enter, recarrega e verifica ausência de mensagens de hidratação e overflow a 375px; passou.

**OK:** E2E real ampliado em `tests/e2e/booking-pix.spec.ts:116` espera um ciclo de polling antes do webhook, verifica ausência de confirmação e reserva persistida `pending_payment`. Após webhook fake assinado, UI e banco ficam `confirmed`. Passou na repetição isolada (1/1, 16,8s). Usa UI em 3001 e ponte para API/Postgres reais em 3103; não comprova implantação integrada nem pagamento bancário. Nenhum token foi publicado.

**MELHORAR / P2 — T3 + T4/ambiente:** `tests/qa/booking-ui.spec.ts:51/:123` falharam por timeout sob execução concorrente. E2E `tests/e2e/booking-pix.spec.ts:113` voltou à etapa serviço antes do Pix. Reprodução inicial e artefatos preservados; todos passaram em repetição focada. Causa de reset não estabelecida; não atribuir defeito ao produto sem prova. Rodar regressões serialmente no servidor de desenvolvimento e investigar reload/HMR se repetir. Impacto: prova inicial instável; não há bloqueio de produto reproduzível nesta rodada.

Gates do worktree QA: `pnpm lint` sem warnings, `pnpm typecheck`, 48/48 unitários e `git diff --check` passaram. Build/integração ampla não repetidos: nenhum código de produto alterado no QA e escopo desta rodada é regressão afetada. Resultados de build anteriores permanecem históricos, sem aprovação nova.

Artefatos: `dogfood-output/regression-a134216-booking/`, `...-booking-repeat/`, `...-preview/`, `...-webhook/`, `...-webhook-repeat/`. Próxima ação: coordenador integrar entregas e avaliar fluxo integrado; pendências do MVP anteriores permanecem. Revalidação aprovada nos cenários exercitados, com instabilidade inicial registrada.

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
