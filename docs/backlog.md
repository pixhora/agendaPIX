# BACKLOG — MVP

## Estado atual

Auditoria de 02/10/2026 (America/Sao_Paulo), branch `feat/backend`, commit base `8783cc57b4013639e07ec3d83ce835a9b2a093a4`. Escopo: esta worktree e o histórico local; não presume entregas em outras branches nem inspeciona credenciais de `.env`.
Equipe válida: somente Terminais 1, 2, 3 e 4. Terminal 3 revisa tecnicamente 1 e 2; Terminal 4 assume página pública, landing e onboarding. Não existem tarefas para terminais 5 ou 6.

O produto ainda não é vendável: há domínio e APIs de reserva testados, mas nenhuma experiência de agendamento ou painel, e nenhum Pix bancário. Reutilizar o que existe, sem reconstruir disponibilidade, schema ou webhook fake.

| Área | Estado | Evidência e limite |
| --- | --- | --- |
| Esqueleto | PARCIAL | Next 16.3.8, TS estrito, Tailwind, botão Radix; build não validado. `master` existe e contém esqueleto; `main` não existe. |
| Backend / APIs públicas | PARCIAL | `app/api/public/[slug]` e `lib/bookings/service.ts`: serviços, horários, reserva e consulta protegida; APIs do painel ausentes. |
| Auth / cadastro / login | PARCIAL | Better Auth, cliente e SMTP em `lib/auth.ts`, `lib/auth-client.ts`, `lib/email.ts`; integração cria conta e sessão por link único. Sem tela de login, provisionamento do negócio ou prova de SMTP real. |
| Banco | COMPLETO | Schema para auth, negócios, serviços, clientes, horários, reservas, pagamentos e auditoria; 25 integrações passam. Completo apenas para o domínio implementado, sem assinatura. |
| Migrations | PARCIAL | Três SQL versionados, incluindo `btree_gist` e exclusão de sobreposição; aplicação limpa/repetida ainda precisa de prova específica. |
| Seed | PARCIAL | `db/seed.mjs`: demo transacional, idempotente e bloqueada em produção; não executado nesta auditoria. |
| Serviços / preços / horários | PARCIAL | Schema, validação e leitura pública existem; cadastro/edição autenticados ausentes. |
| Disponibilidade | COMPLETO | `lib/bookings/availability.ts`: fuso, fechamento, passado, conflitos; testes unitários e integração de concorrência passam. |
| Agendamento | PARCIAL | Reserva transacional, preços do servidor, sinal zero, idempotência, token de consulta e concorrência implementados; falta UI e integração real. |
| Página pública | AUSENTE | Não existe `app/[slug]`; apenas APIs. |
| Painel | AUSENTE | Não existem páginas de dashboard nem APIs autenticadas de domínio. |
| Design system | PARCIAL | Tokens provisórios claros/escuros e único botão; identidade e componentes dos fluxos ausentes. |
| PaymentProvider | PARCIAL | Interface, validação e seleção em `lib/payments`; somente implementação fake. |
| Pix / QR / copia e cola | MOCK | `FakePaymentProvider` gera `FAKE-PIX-NOT-PAYABLE`; indisponível em produção. |
| Webhook | PARCIAL | HMAC fake, auditoria por entrega, deduplicação e confirmação transacional; falta protocolo do gateway real. |
| Trial / assinatura | AUSENTE | Sem schema, cobrança, controle de acesso ou experiência de assinatura. |
| Landing / onboarding | AUSENTE | `app/page.tsx` é aviso provisório, sem oferta, cadastro do negócio ou demo navegável. |
| Testes | PARCIAL | 48 unitários, 25 integrados e 2 E2E passam; sem jornada comercial, painel ou gateway real. |
| Docker / deploy | PARCIAL | `compose.yaml` só inicia Postgres local; sem Dockerfile da aplicação, Coolify, domínio/HTTPS ou prova de deploy. |
| `.env.example` | PARCIAL | Banco, auth, SMTP e fake documentados; faltam variáveis do gateway e operação de produção. |
| Privacidade / exclusão | AUSENTE | Contrato reconhece decisão de retenção pendente; nenhum fluxo ou texto legal aprovado. |
| Build de produção | QUEBRADO | Comando falha neste ambiente por porta interna do Turbopack (`EPERM`); não demonstra defeito de negócio. |

### Validação realizada

| Comando | Resultado real |
| --- | --- |
| `pnpm lint` | Passou, sem warnings. |
| `pnpm typecheck` | Passou, incluindo `next typegen`. |
| `pnpm test` | Passou: 5 arquivos, 48 testes. |
| `pnpm build` | Falhou, código 1: `Failed to write app endpoint /page`, CSS/PostCSS, criar processo/abrir porta, `Operation not permitted`. Repetição solicitada com escalonamento falhou igual. |
| `pnpm test:e2e` | Primeira execução não iniciou servidor no sandbox; repetição escalonada passou: 2 testes Chromium, viewport 375px. Não cobre agendar/pagar. |
| `pnpm test:db` | Primeira execução falhou por conexão `EPERM` ao Postgres; repetição escalonada passou: 3 arquivos, 25 testes. SMTP simulado somente no teste de auth. |

Não foram executados `db:up`, `db:down`, `db:generate`, `db:migrate` ou `db:seed`: alteram infraestrutura/dados e não são necessários para esta auditoria documental; o banco existente permitiu a integração. `dev` foi iniciado pelo Playwright; `start` depende de build aprovado. Não há prova de migration em banco vazio, seed repetido, SMTP real ou deploy.
`git fetch` e tentativa de rebase de `main` não concluíram nesta sessão; foram interrompidos. Sem remote configurado observado; `main` ausente. Não houve atualização comprovada nem rebase sobre outra branch por suposição.
Busca `TODO|FIXME|MOCK|STUB|PLACEHOLDER|console.log` em app/components/lib/db/tests/docs/README não retornou ocorrências. Isso não elimina mocks: o provider fake e o mock SMTP de teste foram identificados por leitura. README ainda descreve esqueleto e um único E2E no início; alinhar documentação sem confundir simulação com produto pronto.

### Ordem e critério comum

IDs abaixo são unidades executáveis; dependências são gates, não autorização para mexer na área de outro terminal. Todas estão pendentes. Cada tarefa exige critérios locais e **G**: lint, typecheck e testes pertinentes passam; contratos atualizados no mesmo commit quando mudarem; sem segredos/logs pessoais; revisão do Terminal 3 para 1/2, QA para 4; merge somente pelo humano. Tarefas de tela exigem estados carregando/vazio/erro/sucesso, PT-BR, teclado, contraste AA, alvos 44px, 375px/desktop e movimento reduzido.
Ordem: fundação → contratos/banco/backend/auth → API pública existente e página pública → painel → Pix real/webhook → E2E crítico → trial/assinatura → landing/onboarding → deploy → validação final. Provisionamento mínimo do negócio (B02) é dependência de cadastro; concluir sua experiência em F07 depois da landing. Não bloquear testes/API pública já existentes pela espera do gateway.

---
# FASE 0 — FUNDAÇÃO

## Terminal 1

- [ ] **B00 — Alinhar contratos e execução da base existente**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: humano confirmar branch-base (`master` existente, `main` ausente); pedidos P01/P02.
  - Critério de pronto: documentar contratos de painel/provisionamento e erros, alinhar README ao estado real e equipe de quatro terminais, registrar sequência de integração sem push/merge automático; G.

## Terminal 2

- [ ] **D00 — Mapear telas do painel aos contratos aprovados**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: B00; esqueleto integrado pelo humano.
  - Critério de pronto: registrar em pedidos as consultas e mutações necessárias, mapear rotas e estados sem alterar schema/migrations ou duplicar backend; G.

## Terminal 3

- [ ] **Q00 — Revisar base backend e reproduzir bloqueio de build**
  - Responsável: Terminal 3.
  - Estado atual: PARCIAL.
  - Dependências: B00; ambiente com portas permitidas; P01/P03.
  - Critério de pronto: emitir bloqueia/melhorar/ok com arquivo e linha para auth, concorrência, tenants, centavos e webhook; reproduzir build e encaminhar causa ao T1; obter build aprovado antes da liberação; G.

## Terminal 4

- [ ] **F00 — Finalizar identidade e tokens compartilhados**
  - Responsável: Terminal 4.
  - Estado atual: PARCIAL.
  - Dependências: esqueleto integrado; docs/design-tokens.md.
  - Critério de pronto: definir assinatura visual, escalas e famílias conforme AGENTS, atualizar tokens claro/escuro e componentes acessíveis usados por público e painel, disponibilizar contrato visual ao T2; G.

# TERMINAL 1 — BACKEND / BANCO / PAGAMENTOS

## Banco

- [ ] **B01 — Provar migrations e seed sem perda de dados**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: B00; banco descartável de teste.
  - Critério de pronto: executar migrations em banco vazio e repetir sem alterações; repetir seed preservando cadastros e slug alheio, comprovar bloqueio em produção e documentar backup/reversão sem DROP; G.

## Backend

- [ ] **B02 — Provisionar negócio do usuário autenticado**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: B00; auth existente; contrato aprovado com T4.
  - Critério de pronto: criar backend de cadastro/consulta do próprio negócio, slug único e validação Zod; owner obtido da sessão, repetição segura sem duplicar negócio; testes de acesso alheio e conflitos; G.

- [ ] **B03 — Entregar APIs do painel para serviços e horários**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: B00/B02; schema existente.
  - Critério de pronto: listar/criar/editar/desativar serviços e configurar intervalo semanal por contrato; validar centavos/duração/sinal e horário; sessão/tenant em toda query; preservar preços históricos e testar efeitos na disponibilidade; G.

- [ ] **B04 — Entregar consultas de agenda e clientes do dono**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: B00/B02; reservas existentes.
  - Critério de pronto: consultar agenda por dia/semana e clientes com filtros validados, fuso e estados coerentes; proteger dados pessoais por sessão/tenant; erros e limites documentados; testes de usuário sem sessão e negócio alheio; G.

## Auth

- [ ] **B05 — Validar envio real e acesso seguro por link mágico**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: SMTP de teste operacional; B00; P03.
  - Critério de pronto: provar envio/consumo/expiração/reuso e saída com SMTP real de teste, origem/cookies em HTTPS e falha de envio sem exposição de token; não adicionar senha ou Google; G.

- [ ] **B06 — Implementar exclusão de conta conforme retenção aprovada**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: decisão humana P05; B02; histórico financeiro existente.
  - Critério de pronto: documentar e implementar processo autorizado de exclusão/minimização compatível com retenção; confirmar identidade e preservar registros exigidos; testar isolamento e impedir exclusão financeira silenciosa; G.

## Agendamento

- [ ] **B07 — Proteger criação pública contra abuso e validar bordas HTTP**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: API existente; B00; Q02.
  - Critério de pronto: definir limite de requisições aplicável a reservas e link mágico e testá-lo; validar entradas, conflitos, token inválido e erros no handler HTTP; manter sinal zero e concorrência sem revelar dados pessoais; G.

## PaymentProvider

- [ ] **B08 — Resolver recuperação de cobrança externa e política de vencimento**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: P04: gateway e regras aprovados; interface existente.
  - Critério de pronto: documentar estado persistente e recuperação em timeout/falha de commit; testar repetição da mesma chave sem segunda cobrança nem divergência de vencimento; evitar chamada externa longa sob lock sem recuperação demonstrada; G.

## Pix

- [ ] **B09 — Implementar gateway Pix real atrás de PaymentProvider**
  - Responsável: Terminal 1.
  - Estado atual: MOCK.
  - Dependências: B08; conta/credenciais e recebedor definidos em P04.
  - Critério de pronto: implementar somente gateway escolhido (Asaas ou Mercado Pago), env validado, centavos e QR/copia-e-cola pagáveis; provar sandbox e uma cobrança real autorizada com valor definido pelo humano; fake bloqueado em produção, erro recuperável sem duplicação; G.

## Webhooks

- [ ] **B10 — Autenticar e normalizar webhook do gateway real**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: B09; protocolo oficial do gateway.
  - Critério de pronto: adaptar assinatura/token do gateway para domínio existente; validar valor/identidade; registrar cada entrega, deduplicar e confirmar atomicamente; testes de repetição, concorrência, valor divergente, falha e evento tardio; G.

- [ ] **B11 — Tratar pagamento tardio e reconciliação operacional**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: B08/B10; decisão humana P04.
  - Critério de pronto: não reocupar reserva vencida; tornar dinheiro recebido fora do prazo visível ao dono; aplicar procedimento aprovado de reconciliação/devolução com trilha de auditoria; recuperação segura após indisponibilidade do webhook; G.

## Assinatura

- [ ] **B12 — Persistir trial de sete dias e estado de assinatura**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: MVP agendamento/Pix validado em Q03; decisão P06.
  - Critério de pronto: migration compatível, início/fim do trial sem cartão e regras de acesso aprovadas; relógio do servidor e tenant; testes de início único, limite exato e expiração; atualizar contrato sem inventar política de bloqueio; G.

- [ ] **B13 — Cobrar assinatura e atualizar acesso idempotentemente**
  - Responsável: Terminal 1.
  - Estado atual: AUSENTE.
  - Dependências: B12/B09/B10; plano/canal/renovação aprovados em P06.
  - Critério de pronto: cobrar mensalidade definida pelo humano sem misturar sinais dos clientes; webhook atualiza período/estado uma vez; testar repetição, atraso e falha; manter valores em centavos e expor situação ao painel; G.

## Infraestrutura

- [ ] **B14 — Preparar aplicação para Docker/Coolify e HTTPS**
  - Responsável: Terminal 1.
  - Estado atual: PARCIAL.
  - Dependências: build aprovado Q00; B05/B09/B10; domínio/VPS/segredos em P07.
  - Critério de pronto: Dockerfile de produção e instruções Coolify, migrations controladas, SMTP/webhook HTTPS, segredos externos, health/readiness, backup e restauração demonstrados; executar deploy autorizado e registrar URL/prova sem credenciais; G.

# TERMINAL 2 — PAINEL DO DONO

- [ ] **D01 — Construir layout protegido e entrada do painel**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D00; auth existente; F00; B02.
  - Critério de pronto: sessão inválida leva ao acesso, negócio não provisionado leva ao onboarding, navegação agenda/clientes/serviços/horários; autorização real permanece no backend; G.

- [ ] **D02 — Exibir agenda diária e semanal com dados reais**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D01; B04.
  - Critério de pronto: mostrar horário local, serviço, cliente e estado de sinal/reserva; alternar dia/semana e datas; distinguir pendente/vencido/confirmado; sem dados fictícios em operação; G.

- [ ] **D03 — Exibir clientes do próprio negócio**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D01; B04.
  - Critério de pronto: lista e consulta dos dados mínimos dos clientes reais, estado vazio e falha recuperável; nenhum cliente de outro tenant acessível; G.

- [ ] **D04 — Gerenciar serviços, preços e sinal**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D01; B03.
  - Critério de pronto: criar/editar/desativar serviço, duração e valores exibidos em reais convertidos seguramente a centavos; servidor valida; evitar perder formulário em erro e refletir serviço publicado na página pública; G.

- [ ] **D05 — Configurar horários e compartilhar página do negócio**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D01; B02/B03; F01.
  - Critério de pronto: editar abertura/fechamento e dias fechados; mostrar/copiar URL pública real e dados do negócio permitidos pelo contrato; alteração refletida na disponibilidade; G.

- [ ] **D06 — Mostrar assinatura e ocorrências financeiras acionáveis**
  - Responsável: Terminal 2.
  - Estado atual: AUSENTE.
  - Dependências: D01; B11/B12/B13; P04/P06.
  - Critério de pronto: mostrar trial/vencimento/status e cobrança própria separada do sinal; orientar pagamento tardio conforme procedimento aprovado; ações usam backend, sem inventar estorno ou regra de bloqueio; G.

# TERMINAL 3 — QA / TESTES / REVISÃO

- [ ] **Q01 — Cobrir acesso autenticado e isolamento das APIs do painel**
  - Responsável: Terminal 3.
  - Estado atual: PARCIAL.
  - Dependências: B02/B03/B04/B05.
  - Critério de pronto: testes HTTP e integração de sessão, tenant alheio, Zod, dados mínimos e atualização de serviços/horários; relatório objetivo para T1; não reescrever implementação; G.

- [ ] **Q02 — Testar contratos HTTP públicos e recuperação financeira**
  - Responsável: Terminal 3.
  - Estado atual: PARCIAL.
  - Dependências: APIs existentes; B07/B08/B09/B10/B11 conforme entregues.
  - Critério de pronto: exercitar handlers com corpo inválido/grande, indisponibilidade, token/chave inválidos, preços adulterados e disputa real; cobrir gateway contratado, cobrança externa órfã/retry e webhook falso/duplicado/tardio; G.

- [ ] **Q03 — Executar E2E de agendar e pagar sinal**
  - Responsável: Terminal 3.
  - Estado atual: AUSENTE.
  - Dependências: F01/F02/F03; B09/B10; banco/SMTP de teste.
  - Critério de pronto: Playwright realiza serviço → horário → cliente → QR/copia-e-cola → evento autenticado → confirmação; casos sinal zero, expirado, ocupado e retry; 375px e desktop; automação usa sandbox/fake identificado, prova real separada em B09; G.

- [ ] **Q04 — Validar painel, onboarding e assinatura ponta a ponta**
  - Responsável: Terminal 3.
  - Estado atual: AUSENTE.
  - Dependências: D01–D06; F06/F07; B12/B13.
  - Critério de pronto: E2E login/criação de negócio/serviço/horário/link público e agenda atualizada; trial e assinatura cobertos; revisar T2 com bloqueia/melhorar/ok e encaminhar bugs aos responsáveis; G.

- [ ] **Q05 — Validar acessibilidade, regressão e liberação final**
  - Responsável: Terminal 3.
  - Estado atual: PARCIAL.
  - Dependências: Q01–Q04; F04/F05; B14.
  - Critério de pronto: executar lint/typecheck/test/test:db/build/E2E em ambiente adequado, registrar resultados e revisão; verificar teclado/AA/375px/desktop/escuro/reduced-motion, ausência de segredos e confirmação real no deploy; sem declarar pronto com bloqueios; G.

# TERMINAL 4 — FRONTEND / AGENDAMENTO / LANDING

## Design system

- [ ] **F04 — Verificar consistência e estados das telas do produto**
  - Responsável: Terminal 4.
  - Estado atual: PARCIAL.
  - Dependências: F00; páginas F01–F03/F05–F07; D01–D06 via pedido ao T2.
  - Critério de pronto: verificar estados, contraste/foco/touch e tokens compartilhados; corrigir somente área T4 e encaminhar painel ao T2; sem efeitos decorativos além do orçamento AGENTS; G.

## Página pública

- [ ] **F01 — Construir /[slug] com serviços e horários reais**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: F00; APIs existentes; seed demo validado B01.
  - Critério de pronto: carregar negócio/serviços, selecionar data/horário e exibir preço/sinal/fuso; negócio inexistente, fechado, lista vazia e erro recuperável; preservar escolhas e atualizar horário ocupado; G.

- [ ] **F02 — Coletar cliente e criar reserva idempotente**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: F01; contrato de criação existente.
  - Critério de pronto: formulário nome/telefone normalizado E.164, validação acessível; gerar UUID por pedido e reutilizar no retry; não enviar preço; guardar token sem analytics/log e tratar 400/409/503; jornada em até quatro passos; G.

- [ ] **F03 — Exibir Pix, vencimento e confirmação por estado do servidor**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: F02; consulta existente; B09/B10 para produção.
  - Critério de pronto: mostrar QR e copiar código, consultar com bearer, parar ao confirmar/vencer e ocultar código inválido; confirmar sinal zero sem cobrança; retomada segura; identificar fake como simulação durante desenvolvimento; G.

## Landing

- [ ] **F05 — Criar landing com oferta e demo reais**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: Q03; preços/planos aprovados P06; F06.
  - Critério de pronto: apresentar promessa do AGENTS, preços aprovados e CTA funcional para acesso; demo usa negócio fictício identificado; texto não promete integração inexistente, desempenho/mobile/a11y verificados; G.

## Onboarding

- [ ] **F06 — Criar cadastro/login por link mágico**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: F00; B05; contratos auth existentes.
  - Critério de pronto: email com label, envio/sucesso/erro/expiração e retorno seguro ao destino; logout disponível; reutilizar authClient, não implementar senha nem revelar links/token; G.

- [ ] **F07 — Configurar primeiro negócio e publicar link de agendamento**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: F06; B02/B03; D04/D05; F01.
  - Critério de pronto: guiar nome/slug/serviço/preço/sinal/horário usando APIs; retomar sem duplicar negócio; ao concluir abrir/copiar página funcional; encaminhar gestão contínua ao painel sem duplicar regras; G.

- [ ] **F08 — Publicar privacidade aprovada e entrada para exclusão**
  - Responsável: Terminal 4.
  - Estado atual: AUSENTE.
  - Dependências: decisão humana P05; B06.
  - Critério de pronto: exibir somente texto legal aprovado e orientação/ação de exclusão respaldada pelo backend; acessível no acesso e agendamento; coletar apenas dados contratados; G.

---
# DEPENDÊNCIAS

- **Terminal 1 → Terminal 2:** B00 fixa contratos; B02 resolve negócio da sessão; B03 habilita serviços/preços/horários; B04 fornece agenda/clientes; B11–B13 alimentam ocorrências e assinatura. T2 registra necessidades, não altera banco.
- **Terminal 1 → Terminal 4:** APIs públicas já existem e podem ser consumidas após integração autorizada; B01 prepara demo; B05 habilita login real; B02/B03 provisionam onboarding; B09/B10 habilitam Pix bancário. Fake só serve a desenvolvimento identificado.
- **Terminal 1/2/4 → Terminal 3:** revisão do backend e painel por entrega; contratos e fixtures estáveis habilitam Q01/Q02; telas/API permitem Q03/Q04; deploy permite Q05. Resultado volta ao autor para correção.
- **Terminal 4 → Terminal 2:** F00 fornece tokens/componentes compartilhados; painel não redefine identidade global. Mudanças globais solicitadas em pedidos.
- **Humano → equipe:** branch-base/merge, gateway/recebedor, tratamento de pagamento tardio, assinatura, LGPD e infraestrutura. Não adicionar decisão comercial por conveniência técnica.

# BLOQUEADORES

1. Build de produção falha por `EPERM` no Turbopack; investigar ambiente e repetir gate, sem afirmar que código está quebrado por isso.
2. Ausência de gateway Pix real e definição de recebedor/conta/credenciais, recuperação e pagamento tardio (P04).
3. Ausência de UI pública, APIs/painel e provisionamento de negócio; MVP não pode ser usado pelo cliente/dono.
4. Revisão histórica direcionada a terminal inexistente: remapeada ao Terminal 3 (P01). Não há ok atual registrado.
5. `main` ausente, branch-base/integracao requer confirmação operacional do humano (P02); nenhum merge desta auditoria.
6. SMTP real, deploy HTTPS, backup e regras de retenção/exclusão não comprovados (P03/P05/P07).
7. Trial/assinatura dependem de regras de plano/acesso/renovação aprovadas (P06); preços R$49/R$79 aprovados pelo humano e registrados em docs/PRECOS.md são referência existente, não novos planos definidos aqui.

# FORA DO MVP

Múltiplos profissionais/unidades, relatórios avançados, app/PWA, API oficial WhatsApp, Google login, senha, marketplace, cupons, integrações extras e analytics antes da necessidade comercial. Não implementar segundo gateway. Lembretes por wa.me ficam após os fluxos 1–3, sem bloquear liberação inicial. Não adicionar edição/cancelamento/reembolso livre de reservas sem regra comercial aprovada. Não redesenhar domínio existente sem evidência.

# DEFINITION OF DONE

O MVP de agendamento exige página pública real, painel operacional, Pix bancário autenticado e idempotente confirmando horário sem dupla reserva. Os gates G e Q05 precisam passar, com evidência de sandbox e prova real autorizada, deploy HTTPS/SMTP, migrations/backup seguros e privacidade/exclusão aprovadas. Trial/assinatura habilitam cobrança do SaaS após validar fluxo crítico, sem ampliar o núcleo. Revisão Terminal 3 sem bloqueia; merge só humano. Nenhuma tarefa fica concluída apenas por possuir arquivo, UI ou teste de mock.

Contagem de unidades pendentes, incluindo fase 0: Terminal 1 **15**; Terminal 2 **7**; Terminal 3 **6**; Terminal 4 **9**. Critérios e dependências não contam como tarefas adicionais.
