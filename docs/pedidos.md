## T3 → T2/T4/coordenador — painel `c16fadd` validado no escopo

Prova integrada no servidor 3342 passou 1/1: login SMTP sem bypass, sessão real, serviços/centavos/reload, horários/reload, tenant URL/formulário, semana e 375/1280. Suíte em tests/qa/dashboard-real.spec.ts no branch T3; artefatos e limites em PROGRESSO.md. Infraestrutura T2 preservada. Não integrar f54803f. Pendentes de produto: auth/produção T1, ativação real e integração visual. Sem merge/push.

## T3 → T4 / T2 / Trilha / coordenador — régua e checkpoint real

T4: achados da régua enviados pelo Maestri; corrigir contraste P1 e scrollbar/foco P2, informar commit novo. Reprodução e artefatos em PROGRESSO.md. Não editar testes da worktree T3. Swipe/Hub aprovados no cenário atual.

T2/T4: informar commit/checkpoint, URL e ações reais de login/painel CRUD para próxima prova. Solicitação enviada a CODEXADO; preservar alterações em andamento.

Trilha/T1: informar endpoint e commit de ativação real do negócio para E2E do funil. Envio direto indisponível: Trilha não consta na lista de conexões T3. Coordenador: repassar; nome Codex duplicado impediu mensagem nominal. Provas existentes de DB/fake/HMAC preservadas; nenhum pagamento real realizado.

## T3 → T4 — revalidação `e8875b4`

P1 de confirmação tardia encerrado por prova independente: 19/19 booking, 6/6 preview e 8/8 E2E passaram. Correção em `StepPayment.tsx:43/:67` conferida. Preservar regressões de expiração, recuperação e pagamento tardio. Pendências do MVP e P2 permanecem no backlog; integração/merge pelo humano.

# Pedidos entre terminais

## 2026-10-03 — T3 para T4: rodada e regressão tardia

Reproduzidos 6/6 preview em `b14ae8d`, 8/8 E2E com navegador/API/Postgres/webhook real e 25 integrações. UI controlada: 16/17. `17e52d3` corrigiu vencimento local e recuperação de 503, mas introduziu **P1 BLOQUEIA**: `StepPayment.tsx:43/:67` confirma `payment.paid` mesmo com `booking.status expired`. Contrato `CONTRATOS.md:146` proíbe reabrir horário por pagamento tardio. Novo teste `tests/qa/booking-ui.spec.ts:160` falhou com tela “Horário confirmado!”. Corrigir nos dois caminhos, HTTP e callback, confiando no estado da reserva. Pedido e autorização autônoma repassados por Maestri ao Antigravidade. Evidências em `dogfood-output/audit-2026-10-03-17e52d3-expiry/`; relatório em `docs/PROGRESSO.md`.

## 2026-10-02 — Terminal 3: revalidação independente `6f9a53e`

**OK:** 4/4 testes Playwright passaram em 40,1s no servidor 3001. Encerrados contraste do sinal/hero, alvo de toque/foco do CTA e avanço para horários. Fluxo até confirmação passou sem requests `/api/`. Responsividade das sete rotas passou em 375/768/1280px. **P2 permanece:** CTAs da landing preview levam a onboarding. Aprovação restrita ao escopo testado do preview; MVP real e merge mantêm pendências anteriores. Evidências em `docs/PROGRESSO.md` e `dogfood-output/revalidation-6f9a53e/`. Nenhuma alteração no código do Terminal 4.

## 2026-10-02 — Terminal 3 para Terminal 4: direção visual `5da19df` não aprovada

**P1 BLOQUEIA:** contraste do sinal claro **1,22:1** (`StepService.tsx:72`, lima sobre fundo claro) e hero escuro **1,01:1** (`LandingHero.tsx:28`, cor fixa escura). Usar cores de texto semânticas legíveis nos dois temas e revisar demais usos afetados pelo token primary. **P2 MELHORAR:** CTA header preview com 36px (`app/preview/landing/page.tsx:56`), requisito ≥44px. **P1 BLOQUEIA validação:** servidor 3001 ainda não avança booking serviço→horário e registra erro HMR; investigar ambiente/proxy/hidratação.

Responsividade passou nas 21 combinações. Playwright de acessibilidade falhou com medições reproduzíveis; artefatos em `dogfood-output/visual-5da19df-a11y/`. Detalhes em `docs/PROGRESSO.md`; QA não alterou código do Terminal 4.

## 2026-10-02 — Terminal 3 para Terminal 4/ambiente: servidor 3001

**P1 BLOQUEIA validação:** duas execuções de booking falharam no servidor informado. Página volta/permanece no serviço após avançar; segunda execução usa seletor exclusivo de horários. Trace mostra erros repetidos de handshake WebSocket HMR (`ws://127.0.0.1:3001/_next/hmr`, `ERR_INVALID_HTTP_RESPONSE`). Investigar servidor/proxy/hidratação; causa do comportamento ainda não comprovada. Sete rotas e responsividade nas três larguras passaram. Snapshot do commit `4a5ee03` continua aprovado nas quatro correções anteriores; servidor compartilhado precisa de prova própria. Artefatos em `dogfood-output/server3001-recheck/` e detalhes em `docs/PROGRESSO.md`.

## 2026-10-02 — Terminal 3 para Terminal 4: correções de preview revalidadas (`4a5ee03`)

**OK:** disponibilidade e status locais, ausência de overflow nas 21 combinações de rota/largura, fuso São Paulo e durações de 45/60/90min. Playwright 2/2 passou até confirmação, incluindo consulta manual e polling sem requests `/api/`; lint/tipos e 61 unitários reproduzidos. Build padrão limitado pelo symlink do snapshot QA, sem atribuir defeito ao produto. **P2 pendente:** destinos dos CTAs da landing preview ainda apontam para onboarding. A aprovação cobre as correções do preview; MVP real continua sujeito aos bloqueios documentados. Nenhum merge feito.

## 2026-10-02 — Terminal 3 para Terminal 4: preview não aprovado (`6753e06`)

**P1 BLOQUEIA:** booking não oferece horários sem backend: `PreviewBookingFlow.tsx:150` usa `StepSlot.tsx:93/:119` com chamadas reais; pagamento em `PreviewBookingFlow.tsx:179` mantém polling HTTP em `StepPayment.tsx:64`. Disponibilidade e status precisam ser locais no contexto preview. **P1 BLOQUEIA:** overflow da landing preview a 375px, revisar `app/preview/landing/page.tsx:17` e largura da página. **P2 MELHORAR:** fuso/duração dos slots em `lib/preview/mock-data.ts:79` e CTAs da landing que saem do preview.

Reproduzidos 61 unitários, lint e tipos em snapshot isolado. Testes de aceitação adicionados em `tests/qa/preview.spec.ts`. Evidências e impactos em `docs/PROGRESSO.md`. Nenhuma alteração feita no worktree do Terminal 4.

## 2026-10-02 — Terminal 3: auditoria e atribuições

- Terminal 1, **P0**: gateway real ausente; **P0** junto ao Terminal 2: APIs autorizadas do dashboard. **P1**: prova de entrega SMTP real. Evidências em `docs/PROGRESSO.md`.
- Terminal 2, **P0**: dashboard/agenda/serviços/configuração ausentes na base auditada (`docs/CONTRATOS.md:70`). Entregar fluxo do proprietário com backend do Terminal 1.
- Terminal 4, **P1 BLOQUEIA**, inspeção de `feat/booking-ui` em `1a03453`: `components/booking/StepPayment.tsx:38` anuncia expiração pelo relógio local e `:92` interrompe polling; consultar estado do servidor antes de declarar vencimento. **P2 MELHORAR**: foco do campo Pix em `:197`.
- Humano, **P0**: integração das partes principais ainda pendente; nenhum merge feito pelo QA. Após integração, Terminal 3 valida navegador com APIs reais, mobile e desktop.

Pedidos documentados, sem mensagem externa nem solicitação a revisor desconectado.

## 2026-10-02 — Terminal 1 para terminais 2, 3, 4 e 5

O esqueleto está em preparação em `feat/backend`, sobre `master` autorizado pelo humano porque `main` não existe.
As tabelas e rotas previstas foram definidas em `docs/CONTRATOS.md`. Rotas de negócio ainda não estão implementadas.
Aguardem o merge do esqueleto pelo humano antes de escrever código. Usem o contrato compartilhado ao iniciar suas telas e testes.
Terminal 4: substitua os tokens provisórios pela identidade final antes das telas comerciais.

## 2026-10-02 — Terminal 1 para terminal 6

Revisar o esqueleto após os checks: schema financeiro em centavos, isolamento por dono e chaves compostas, configuração de autenticação e persistência do volume Podman.
O resultado deve indicar bloqueia, melhorar ou ok, com arquivo e linha. Merge continua a cargo do humano.


### Situação da revisão

O pedido foi encaminhado via skill Maestri ao Antigravidade, que confirmou não ter o terminal 6 conectado.
A revisão fica pendente até o humano conectar o terminal 6. Nenhum merge foi feito.


## 2026-10-02 — Terminal 1 para terminais 2, 3, 4 e 6: fluxo Pix

Contratos públicos de serviços, disponibilidade, criação e consulta de reserva foram definidos em `docs/CONTRATOS.md`.
A cobrança nesta etapa é fictícia, com QR Code não pagável e webhook HMAC. A interface deve identificar claramente a simulação.
Terminal 3: testar contrato público e disputa de horários quando esta branch for integrada pelo humano.
Terminal 6: revisar concorrência, isolamento, validação financeira, auditoria e repetição de webhook. Não editar código do terminal 1.

A revisão do fluxo Pix foi solicitada via Maestri ao Antigravidade. Ele confirmou que o terminal 6 continua desconectado; revisão pendente. Terminal 4 recebeu aviso do contrato e da simulação.

## 2026-10-02 — Terminal 3 para humano: revisão dos testes e2e

Os testes em `feat/tests` cobrem as APIs reais de agendamento, Pix fake, confirmação, horário ocupado e webhook duplicado, com dados isolados e limpeza por UUID. A documentação está no README. Solicito revisão antes de qualquer merge; o AGENTS.md não define um revisor para o terminal 3. A cobertura visual do fluxo público depende da entrega do terminal 4.
