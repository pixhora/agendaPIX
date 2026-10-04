# Progresso da Aplicação — Frontend Público, UX/UI e Conversão (Terminal 4)

> Data de atualização: 2026-10-02  
> Responsável: Terminal 4 (`feat/booking-ui`)  
> Papel: Frontend Público, UX/UI, Design System, Onboarding e Conversão

---

## 1. Telas Concluídas

### A. Landing Page de Vendas e Conversão (`/`)
- **Header**: Navegação fluida, identificador do produto ("Agenda Pix"), links de ancoragem e botões de ação ("Entrar" e "Começar grátis").
- **Hero**:
  - Promessa central rigorosamente alinhada ao `AGENTS.md`: *"Seu cliente agenda sozinho, paga o sinal por Pix e você para de perder horário."*
  - Subtítulo focado na dor real de prestadores de serviço (barbearias, salões, clínicas, personal trainers).
  - CTAs claros: "Começar teste grátis de 7 dias" e "Ver demonstração ao vivo".
  - Garantias de baixo atrito: sem cartão de crédito, ativação em 3 minutos e cancelamento livre.
- **Seção Problema vs. Solução**: Contraste direto entre a rotina desgastante de mensagens manuais no WhatsApp e o agendamento autônomo com sinal via Pix.
- **Demonstração Interativa em 4 Passos**: Preview funcional simulando o uso real em celular (375px) com alternância de passos (Serviço → Horário na régua → Dados → Pix).
- **Tabela de Preços Oficial (docs/PRECOS.md)**:
  - **Plano Base (R$ 49/mês)**: 1 profissional, agendamentos ilimitados, cobrança de sinal no Pix com confirmação imediata, lembretes de WhatsApp, 7 dias grátis sem cartão.
  - **Plano Completo (R$ 79/mês - Destaque)**: Tudo do base + múltiplos serviços, relatórios de faturamento e agendamentos, gestão completa de clientes e suporte prioritário via WhatsApp.
- **Perguntas Frequentes (FAQ)**: Respostas objetivas para as principais dúvidas do prestador de serviços no Brasil.
- **Rodapé**: Navegação secundária e termos.

### B. Página Pública de Agendamento (`/[slug]`)
- **Passo 1 (Serviço)**: Listagem de serviços ativos, duração em minutos/horas, valor total e destaque para o sinal Pix exigido (ou indicação de "Sem sinal").
- **Passo 2 (Horário - Elemento Memorável)**:
  - Régua tátil de datas para os próximos 7 dias com contador em tempo real de vagas restantes ("Hoje · 3 vagas", "Amanhã · 8 vagas", "Sem vagas").
  - Grade de horários com botões acessíveis de 44px de altura mínima.
  - Estados completos: carregando (skeleton), sem vagas no dia, erro ao consultar e seleção ativa.
- **Passo 3 (Dados do Cliente)**:
  - Resumo fixo do atendimento (serviço, data, horário, valor total, sinal agora e restante no local).
  - Campos com labels acessíveis, autocomplete nativo (`name`, `tel`), máscara de telefone brasileiro com DDD e validação imediata.
  - Botão de ação transparente: *"Pagar sinal de R$ XX,XX"*.
- **Passo 4 (Pagamento do Sinal por Pix)**:
  - Aviso visual obrigatório de ambiente de teste/demonstração simulado (conforme contratos do Terminal 1).
  - Cronômetro regressivo de 15 minutos até a expiração da reserva.
  - Exibição de QR Code nítido e campo Copia e Cola com botão de cópia rápida e feedback tátil ("✓ Copiado!").
  - Polling automático do status de pagamento a cada 4 segundos via endpoint autenticado com Bearer token.
  - Botão manual de verificação ("Já fiz o pagamento no banco").
  - Tela de tempo esgotado com botão para reiniciar a reserva.
- **Confirmação de Agendamento**:
  - Tela de sucesso com resumo completo do agendamento.
  - Botão de envio rápido com mensagem pré-preenchida para o WhatsApp (`https://wa.me/?text=...`).
  - Botão para iniciar outro agendamento.

### C. Fluxo de Onboarding do Dono (`/onboarding`)
- **Passo 1 (Negócio)**: Nome do estabelecimento e geração automática de link amigável (`agenda.com.br/[slug]`) com sanitização de acentos e caracteres especiais.
- **Passo 2 (Primeiro Serviço)**: Nome do procedimento, duração (15 a 120 min), preço total e sinal recomendado com orientação pedagógica sobre no-show.
- **Passo 3 (Horários de Atendimento)**: Seleção dos dias de funcionamento da semana e horários de abertura e fechamento.
- **Passo 4 (Conta e Ativação do Teste Grátis)**: Resumo da configuração, email para autenticação sem senha (Better Auth Magic Link) e ativação dos 7 dias grátis sem cartão.
- Persistência automática do rascunho de onboarding localmente para evitar perda de dados se o celular recarregar.

### D. Modo Preview Profissional (`/preview`)
- **Hub Central (`/preview`)**: Painel de navegação geral para todas as áreas do produto com resumo financeiro do Studio Bella (São Paulo SP), métricas de faturamento e acesso rápido às 6 telas.
- **Landing Preview (`/preview/landing`)**: Demonstração da landing page real com fluxo de navegação adaptado ao ambiente de desenvolvimento.
- **Booking Preview (`/preview/booking`)**: Fluxo do cliente final no celular em 4 passos (serviço → régua de horários → dados → Pix simulado → confirmação), com atalho de simulação imediata de pagamento no banco e dados locais sem dependência de banco de dados ou APIs remotas.
- **Dashboard Preview (`/preview/dashboard`)**: Visão operacional do dono com faturamento previsto (R$ 370,00), sinais Pix pagos (R$ 105,00), timeline da agenda do dia e lista de clientes.
- **Reservas Preview (`/preview/reservas`)**: Gestão de clientes com filtros por status (`confirmadas` com sinal pago, `aguardando sinal`), valores em centavos e link para WhatsApp (`wa.me`).
- **Serviços Preview (`/preview/servicos`)**: Exibição dos 3 procedimentos determinísticos (Corte feminino R$ 80,00 60min, Corte + escova R$ 120,00 90min, Manicure R$ 45,00 45min) com dinheiro em centavos e sinal Pix.
- **Configurações Preview (`/preview/configuracoes`)**: Horário de funcionamento, fuso `America/Sao_Paulo` e perfil da empresa.
- **Indicador Elegante de Preview**: `PreviewBadge` flutuante e discreto com pílula minimalista e menu colapsável para alternar entre as 7 áreas sem poluir a interface.

---

## 2. Fluxos Concluídos

1. `Serviço → Horário → Dados do Cliente → Pagamento Pix → Confirmação` (100% implementado e integrado).
2. Navegação bidirecional (o cliente pode voltar e alterar serviço ou horário sem quebrar o fluxo).
3. Geração de chave de idempotência UUID v4 por tentativa de reserva para proteção contra duplicações.
4. Onboarding com 4 passos guiados e acionamento do fluxo de autenticação por link mágico.
5. Modo Preview 100% funcional offline para visualização e desenvolvimento imediato via `pnpm dev`.

---

## 3. Integrações de Backend Utilizadas

- `GET /api/public/[slug]/services`: Consulta de serviços ativos e dados do estabelecimento.
- `GET /api/public/[slug]/availability`: Consulta de slots disponíveis por data no fuso horário do negócio.
- `POST /api/public/[slug]/bookings`: Criação de reserva pública com header `Idempotency-Key` e tratamento de disputa concorrente (`409 Conflict`).
- `GET /api/public/[slug]/bookings/[id]/payment`: Consulta segura do status do Pix com token de acesso efêmero.
- `POST /api/auth/sign-in/magic-link`: Disparo de link mágico do Better Auth no onboarding.

---

## 4. Testes e Validação de Qualidade

- **Testes Unitários (Vitest)**:
  - `tests/unit/booking-ui.test.ts`: 6 testes passando (formatação de moeda BRL em centavos, duração, máscara de telefone, validação com DDD, normalização E.164, timezone).
  - `tests/unit/onboarding.test.ts`: 3 testes passando (normalização de slugs em português com acentos, caracteres especiais, pontuações e hífens).
  - `tests/unit/preview.test.ts`: 4 testes passando (dados determinísticos do Studio Bella, 3 serviços em centavos, métricas e slots).
  - Total da suíte: **8 arquivos de testes e 61 testes passando**.
- **Lint**: `pnpm lint` passando sem erros e com 0 warnings (`eslint . --max-warnings=0`).
- **Tipagem**: `pnpm typecheck` passando sem inconsistências.
- **Design Tokens**: Cores WCAG AA/AAA, fontes Google Fonts (`Plus Jakarta Sans` e `Inter`) aplicadas no `app/layout.tsx`.
- **Responsividade e Refinamentos de QA (Terminal 3)**:
  - Layouts construídos e validados para mobile-first (375px), tablets (768px) e desktop (1024px+).
  - Eliminado qualquer overflow horizontal em 375px no header e no mockup da Landing page.
  - Desacoplamento completo do modo preview via injeção de `getSlotsForDate` e `checkStatusFn` em `StepSlot` e `StepPayment`, operando 100% offline sem chamadas HTTP bloqueantes.
  - Slots de disponibilidade gerados com respeito estrito a `America/Sao_Paulo` e duração do serviço.

### E. Nova Direção Visual Verde-Lima & Editorial (Referência Visual)
- **Design Tokens**: Paleta de alto contraste inspirada em neo-editorial fintech:
  - Fundo Canvas Off-white (`#F5F6F2`)
  - Títulos e textos principais em Preto Carvão (`#111613`)
  - Acento Primário em Verde-Lima vibrante (`#C0F739`) para botões de conversão e badges de alta energia
  - Acento Secundário em Verde Petróleo profundo (`#0F3B2E`) para solidez e títulos
  - Formato **Pill** (`rounded-full`) em todos os botões de ação e tags de categoria
- **Hero em Duas Colunas**:
  - *Esquerda*: Título editorial, subtítulo espaçado, CTAs pill e badges de nichos atendidos (`[Barbearias]`, `[Salões]`, `[Clínicas]`, etc.).
  - *Direita*: Composição com círculos concêntricos e 3 cards em sobreposição (Card de faturamento com gráfico de barras, Card central verde-lima de Pix instantâneo, e Card escuro do próximo horário agendado).
- **Faixa de Credibilidade / Segmentos (`LandingTrustBand`)**: Grid horizontal sóbrio dos segmentos atendidos.
- **Seção Editorial de Benefícios (`LandingEditorialBenefits`)**: Título amplo e grid de 4 blocos visuais conforme referência.
- **Banner Largo Verde-Lima (`LandingHighlightBanner`)**: Card dark mode com faturamento do dia (Studio Bella) à esquerda e os 3 passos simples de ativação à direita.
- **Preços e FAQ Harmonizados**: Cards com bordas arredondadas `rounded-3xl` e botões pill preservando os valores oficiais de R$ 49 e R$ 79 conforme `docs/PRECOS.md`.

### F. Rodada de Verificação do Sistema (2026-10-03)
- **Acessibilidade & Teclado**:
  - Implementada navegação completa por teclado (WAI-ARIA) no radiogroup de serviços em `StepService.tsx` com setas (`ArrowDown`, `ArrowRight`, `ArrowUp`, `ArrowLeft`).
  - Ajustado `prefers-reduced-motion` no `app/globals.css` para `transition-duration: 0s !important` e `animation-duration: 0s !important`.
  - Contraste do valor Pix em `StepPayment.tsx` ajustado com `text-foreground` para contraste AAA (>= 16:1) em superfícies claras e escuras.
- **Correção P1 Bloqueia (StepPayment & Expiração de Reserva)**:
  - *Problema apontado por T3*: `StepPayment.tsx` marcava `isExpired` exclusivamente pelo relógio local (`diff <= 0`), cancelando o polling e impedindo a confirmação se o endpoint retornasse `confirmed` logo após o tempo limite local.
  - *Correção aplicada*: Ao atingir o fim da contagem local (`diff <= 0`), `StepPayment.tsx` consulta imediatamente o servidor antes de declarar o agendamento expirado. Se o servidor responder `confirmed`, a reserva é confirmada; se falhar na consulta (ex.: 503), mantém a tela de pagamento com mensagem amigável e botão de nova tentativa; a tela de expiração só é exibida se o servidor expressamente confirmar o status `expired`.
  - *Contrato de Pagamento Tardio*: Em estrita aderência ao `CONTRATOS.md`, pagamentos recebidos após o cancelamento/expiração da reserva (`status === 'expired'`) não reabrem o horário já liberado, mantendo a tela de expiração ativa mesmo com `payment.status === 'paid'`.
- **Resultados de Verificação e Gates**:
  - `pnpm lint`: 0 warnings (`eslint . --max-warnings=0`).
  - `pnpm typecheck`: 0 erros (`next typegen && tsc --noEmit`).
  - `pnpm test`: 8 arquivos / 61 testes unitários aprovados (100%).
  - `pnpm build`: build Turbopack concluído com sucesso em 1.2s.
  - `Playwright Preview E2E`: 6/6 testes aprovados em 42.2s.
  - `Playwright QA Booking UI (T3 Suite)`: 19/19 testes aprovados (100%), cobrindo consulta antes de expirar, recuperação de falha perto do vencimento e rejeição de pagamento tardio para horário liberado.

### G. Auditoria Visual Completa com agent-browser e Resolução do Bug de Tema Escuro (2026-10-03)
- **Investigação e Reprodução de Bug Visual**:
  - *Evidência do Usuário*: Imagem `/tmp/Maestri-drops/cbf49dad-3e94-495c-8fc9-dcce9b21786d.png` reportou seção "Vantagens" com título desaparecido (preto sobre fundo escuro), palavras "horários vazios" em verde escuro ilegível e excesso de espaçamento vertical.
  - *Causa Raiz Identificada*: Componentes `LandingEditorialBenefits.tsx`, `LandingTrustBand.tsx`, `LandingPainSolution.tsx`, `LandingPricing.tsx`, `LandingFaq.tsx` e `app/preview/page.tsx` herdavam `bg-background` (`#0E1612` no escuro) mas continham classes utilitárias com cores fixas estáticas (`text-[#111613]`, `text-[#0F3B2E]`, `border-[#E2E6DF]`, `bg-white`).
  - *Correção*: Substituição sistemática por tokens semânticos de `@theme inline` (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-surface`, `bg-background`, `text-primary`, `bg-primary`). "horários vazios" agora renderiza em verde-lima vibrante (`text-primary`) no modo escuro e verde-petróleo no modo claro, ambos com contraste WCAG AA/AAA.
  - *Ajuste de Ergonomia no Preview*: `PreviewBadge` flutuante reposicionado no mobile para `fixed top-2.5 right-2.5 sm:top-auto sm:bottom-3 sm:right-3` com backdrop e listener de clique fora/Escape, evitando sobreposição com o botão de submissão do formulário de agendamento em viewports estreitas de 375px.
- **Auditoria de Todas as Telas no Navegador Real (`agent-browser`)**:
  - `http://127.0.0.1:3001/` (Landing): testada em 1359x800 e 375x812, temas Claro e Escuro, com captura de todas as seções (Hero, Vantagens, Como Funciona, Demonstração, Comparativo Real, Planos e FAQ).
  - `http://127.0.0.1:3001/preview` (Hub): navegação para as 6 rotas determinísticas, cards com contraste adaptativo.
  - `http://127.0.0.1:3001/preview/booking`: fluxo completo do cliente testado passo a passo em 375px (Passo 1: Serviço → Passo 2: Horário na régua → Passo 3: Dados → Passo 4: QR Code Pix + Simulador de confirmação → Tela final com WhatsApp).
  - `http://127.0.0.1:3001/preview/dashboard`, `/preview/reservas`, `/preview/servicos`, `/preview/configuracoes`: auditados e aprovados.
  - `http://127.0.0.1:3001/onboarding`: 4 passos auditados no mobile e desktop.
  - `http://127.0.0.1:3001/[slug]`: estado de carregamento skeleton e estado de erro amigável validados.
- **Resultados de Verificação e Gates**:
  - `pnpm lint`: 0 warnings (`eslint . --max-warnings=0`).
  - `pnpm typecheck`: 0 erros (`next typegen && tsc --noEmit`).
  - `pnpm test`: 8 arquivos / 61 testes unitários aprovados (100%).
  - `Playwright QA Booking UI (T3 Suite)`: 19/19 testes aprovados (100%).
  - `pnpm build`: build de produção Turbopack concluído com sucesso em 1.3s com 12 rotas estáticas geradas.

### H. Correção de Erro de Hidratação React no Onboarding (2026-10-03)
- **Investigação e Reprodução de Erro de Hidratação**:
  - *Evidência do Usuário*: Imagem `/tmp/Maestri-drops/32ed2302-df3b-45dd-9131-172a28503859.png` indicava erro do React: *"A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. button type='submit' Continuar, server disabled='' client disabled={false}"*.
  - *Identificação da Causa Raiz*: Em `components/onboarding/OnboardingFlow.tsx`, o hook `useState` inicializava lendo `localStorage.getItem("agenda_onboarding_draft")` caso `typeof window !== "undefined"`. No SSR (`typeof window === "undefined"`), os campos de nome e slug eram inicializados vazios (`""`), resultando no botão "Continuar" desabilitado (`disabled=""`). No navegador, a presença de um rascunho salvo gerava campos válidos e o botão habilitado (`disabled={false}`) durante a hidratação inicial, violando a exigência de árvore idêntica entre servidor e cliente.
  - *Correção Aplicada*:
    - O `useState` agora inicializa sempre com o estado padrão determinístico (`businessName: ""`, `slug: ""`), garantindo que a renderização no servidor e a primeira árvore do cliente coincidam estritamente sem discrepâncias de atributos HTML.
    - A recuperação do rascunho salvo no `localStorage` foi movida para execução assíncrona pós-montagem (`useEffect` com `queueMicrotask`), restaurando os dados do usuário sem acionar cascading renders nem violar regras do React 19 (`react-hooks/set-state-in-effect`).
- **Validação com `agent-browser` (Porta 3001)**:
  - *Com rascunho pré-existente*: `localStorage` populado com dados válidos e recarregado; console inspecionado com `agent-browser console` — **0 erros de hidratação** e dados devidamente restaurados.
  - *Com storage vazio*: `localStorage` limpo e recarregado; botão "Continuar" permaneceu desabilitado até preenchimento; digitação ativou o botão e avançou para o Passo 2 sem erros.
  - *Viewports e Temas*: Auditado em 375px e desktop 1280px, modos Claro e Escuro, com console 100% limpo.
- **Quality Gates e Regressão**:
  - Novo teste de validação de formulário adicionado a `tests/unit/onboarding.test.ts` (62 testes unitários passando).
  - `pnpm lint`: 0 erros / 0 warnings.
  - `pnpm typecheck`: 0 erros.
  - `Playwright QA (T3 Suite)`: 19/19 testes e2e aprovados.
  - `pnpm build`: build Turbopack bem-sucedido em 1.4s.

---

## 5. Pendências e Próximos Passos (Outros Terminais)

- **Terminal 1**: Quando houver transição do Pix fake para o gateway bancário real (Asaas / Mercado Pago), manter o mesmo formato de resposta no `PaymentProvider`.
- **Terminal 2**: Reutilizar os layouts e componentes do dashboard e reservas desenvolvidos no preview para as rotas autenticadas de produção (`/dashboard/*`). Aviso registrado em `docs/pedidos.md`.

---

## 6. Status de Entrega (T5 — Conversion / Onboarding / Login)

### Checkpoint Operação Maestri (2026-10-03)
- **Worktree / Branch**: `/var/home/matheus/projetos/agenda-conversion` @ `feat/conversion`
- **Último Commit**: `e5d8843`
- **Commits Entregues**:
  - `e9dfba4`: Mensalidade R$ 49 (Base) e R$ 79 (Completo) alinhada a `docs/PRECOS.md`.
  - `4fe0e1d`: Persistência de etapa do onboarding no `localStorage` sem hydration mismatch + validação inline.
  - `f0927df`: Feedback inline em tempo real no `StepBusiness` (nome < 2 chars, slug < 2 chars / regex).
  - `9317cc1`: Landing Decide/Learn alinhada a `AGENTS.md`, eliminando alegações de Pix automático.
  - `d972de2`: Clarificação de recebimento via gateway integrado Asaas/MP sem chave pessoal no WhatsApp.
  - `3195b99`: Touch targets de exatos 44px nos links de rodapé (`LandingFooter.tsx`).
  - `88ce4d2`: Redesenho mobile-first 375px: botões full-width `min-h-12` (48px), grid de nichos balanceado e inputs táteis.
  - `9e36847`: LandingHeader responsivo mobile: badge SINAL oculta `< sm`, Entrar link texto compacto `min-h-11`, CTA primário `whitespace-nowrap min-h-11` sem corte em 320px/360px/375px (homologado por T4 em `7002e78`).
  - `e5d8843`: Remoção de simulação de sucesso em desenvolvimento fora de `/preview` em `app/login/page.tsx` e `StepAccount.tsx`; criação de `lib/magic-link.ts` e suíte de testes `tests/unit/login-auth.test.ts`. Falha 500/rede exibe erro observável com `role="alert"`, NUNCA enviado fictício.
  - `3ac321b`: Implementação A3 (`PLANO_ANIMACOES.md`): Micro-interações táteis nos CTAs (`duration-120 active:scale-[0.98] motion-reduce:transform-none`), transição suave de progresso/passo no Onboarding (`duration-240 ease-out`), alertas de erro/sucesso discretos (`duration-180 ease-out`), hero com sequência única e sóbria sem animação decorativa contínua, acessibilidade estrita com `motion-reduce:transition-none motion-reduce:transform-none`, e renderização imediata do conteúdo SSR sem dependência de JavaScript para visualização.
  - Entrega T5-V1 (`PLANO_OPERACIONAL.md`): Correção de alvos táteis < 44px comprovados via agent-browser:
    - `components/landing/LandingHeader.tsx`: logo link e links da navegação desktop com `min-h-11` (alvo >= 44px).
    - `app/login/page.tsx`: logo link, link "Criar conta" e link "Começar 7 dias grátis" com `min-h-11` (alvo >= 44px).
    - `components/onboarding/OnboardingFlow.tsx`: logo link com `min-h-11 py-1` (alvo >= 44px).
    - 0 elementos < 44px em mobile 375px e desktop 1280px; 0 overflow horizontal (`hasHScroll: false`).
- **Quality Gates**:
  - `pnpm lint`: 0 warnings / 0 erros.
  - `pnpm typecheck`: 0 erros.
  - `pnpm test`: 11 arquivos, 77/77 testes unitários aprovados (100%).
- **Provas Browser (`agent-browser`)**:
  - Landing (`/`): 375px e desktop, dark e light, `undersizedCount: 0`, `hasHScroll: false`.
  - Login (`/login`): formulário canônico `LoginForm` com input e botão `min-h-12`, alvos >= 44px, erro observável com `role="alert"`.
  - Onboarding (`/onboarding`): 4 passos fluidos com micro-interações táteis e validação inline.
- **Entregas de Soluções (Hermes)**:
  - **1) F-01 (Provisionamento)**: Módulo `lib/provisioning.ts` criado com Zod schema `provisioningPayloadSchema`, serialização estrita em centavos inteiros, helper `provisionBusiness` e testes unitários em `tests/unit/provisioning.test.ts`. Pronto para ligar quando T1 publicar o endpoint.
  - **2) F-02 (Login Canônico)**: Componente oficial extraído em `components/auth/LoginForm.tsx` e consumido por `app/login/page.tsx`. Guia completo de integração para o dashboard entregue em `docs/LOGIN_CANONICO_T2.md` e registrado em `docs/pedidos.md`.
  - **3) SMTP (Bloqueio Resend)**: Documentado em `docs/BLOQUEIOS.md`. Resend em modo de teste permite envio apenas para a conta dona (`francatorresmatheus@gmail.com`). Liberação para clientes externos exige verificação de domínio próprio no painel Resend (decisão/credencial do humano, não código).
- **Bloqueios e Próximos Passos**:
  - F-01 aguarda implementação do endpoint de provisionamento por T1.
  - F-02 aguarda adoção do `LoginForm` pelo CODEXADO (T2) no dashboard.
  - SMTP para clientes reais aguarda verificação de domínio no Resend pelo humano.

