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
- **Tabela de Preços Oficial (AGENTS.md)**:
  - **Plano Base (R$ 29/mês)**: 1 profissional, agendamentos ilimitados, sinal por Pix automático, lembretes de WhatsApp, 7 dias grátis sem cartão.
  - **Plano Completo (R$ 59/mês - Destaque)**: Tudo do base + múltiplos serviços, relatórios de faturamento e agendamentos, gestão completa de clientes e suporte prioritário via WhatsApp.
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
- **Preços e FAQ Harmonizados**: Cards com bordas arredondadas `rounded-3xl` e botões pill preservando os valores oficiais de R$ 29 e R$ 59.

---

## 5. Pendências e Próximos Passos (Outros Terminais)

- **Terminal 1**: Quando houver transição do Pix fake para o gateway bancário real (Asaas / Mercado Pago), manter o mesmo formato de resposta no `PaymentProvider`.
- **Terminal 2**: Reutilizar os layouts e componentes do dashboard e reservas desenvolvidos no preview para as rotas autenticadas de produção (`/dashboard/*`). Aviso registrado em `docs/pedidos.md`.

---

## 6. Status de Entrega

O fluxo de agendamento público (`/[slug]`), a landing page (`/`), o onboarding (`/onboarding`), o Modo Preview completo (`/preview/*`) e a nova Direção Visual Verde-Lima & Editorial estão totalmente implementados, integrados e testados.

O projeto está **pronto para auditoria do Terminal 3 (Testes e2e / QA)**.
