# Verificação Rota a Rota — Área T5 (Landing, Login, Onboarding)

- **Data / Hora**: 2026-10-04 11:57 BRT
- **Worktree**: `/var/home/matheus/projetos/agenda-conversion` (`feat/conversion`)
- **Porta / Host**: `http://localhost:3005` (Next.js 16.3.8)
- **Status da Inspeção**: Somente Leitura (sem alterações em código de produto)

---

## 1. Tabela de Rotas Auditadas

| Rota | Método | Status HTTP | Comportamento Observado | Problema Identificado (Arquivo:Linha) | Classificação |
|---|---|---|---|---|---|
| `/` | `GET` | 200 | Renderização completa SSR da landing page. Header, Hero, Demonstração em 4 passos, Preços oficiais R$ 49/R$ 79, FAQ e Footer operacionais. Alvos de toque >= 44px e sem overflow horizontal (`hasHScroll: false`) em 375px e desktop 1280px. | Nenhum defeito funcional na landing. Navegação por âncoras internas (#como-funciona, #precos). | **OK** |
| `/login` | `GET` | 200 | Renderização acessível do formulário com card centralizado, input tátil `min-h-12`, botão `min-h-12` `rounded-full` de alto contraste, suporte completo a dark/light e alvos táteis >= 44px. | **Divergência de Rota Única (F-02)**: rota ativa em conversion é `/login`, enquanto o painel do dono (T2) serve login em `/dashboard/login` com UI desatualizada (`app/login/page.tsx:1`). | **MELHORAR** |
| `/login` | `POST` (API) | 200 / 500 | Dispara requisição para `/api/auth/sign-in/magic-link`. Sob sucesso (e-mail cadastrado no Resend), transiciona para `"Verifique seu e-mail"`. Sob falha 500/rede, exibe `role="alert"` observável, NUNCA mente sucesso. | **Restrição de Provedor SMTP**: Conta Resend atual em modo teste permite envios somente para `francatorresmatheus@gmail.com`. Qualquer outro endereço rejeitado pelo servidor SMTP com erro 550 (`lib/email.ts:14`). | **MELHORAR** |
| `/onboarding` | `GET` | 200 | Stepper de 4 passos com rascunho persistido em `localStorage`: (1) Nome/slug do negócio, (2) Serviço/preço/sinal Pix, (3) Dias/horários de atendimento, (4) Conta/Magic Link. Micro-interações táteis e validações inline ativas. | Nenhum erro de renderização visual. Alvos táteis >= 44px após commit `a62b392`. | **OK** |
| `/onboarding` (StepAccount) | `POST` (API) | 200 / 500 | Dispara magic-link de ativação para a conta do dono. Transiciona para tela de sucesso sem aviso de simulação quando enviado com sucesso. | **Persistência de Negócio Ausente (F-01)**: `components/onboarding/StepAccount.tsx:36` — após o envio do magic link, o onboarding não persiste dados do negócio, primeiro serviço ou horários no banco de dados PostgreSQL do backend (T1). Dono ativa a conta mas o tenant não é criado no banco. | **BLOQUEIA** |
| `/api/auth/sign-in/magic-link` | `POST` | 200 / 500 | Endpoint local Better Auth com transporte SMTP Resend. Valida e-mail e gera registro de verificação no PostgreSQL. | **Log e Provedor**: Retorna 200 para destinatário autorizado (`francatorresmatheus@gmail.com`) e 500 para destinatários gerais devido à falta de domínio próprio verificado no Resend (`lib/email.ts:14`). Zero vazamento de PII nos logs do servidor. | **MELHORAR** |

---

## 2. Detalhamento dos Achados

### A. Rota `/` (Landing Page) — Classificação: OK
- **Arquivo**: `app/page.tsx`, `components/landing/LandingHeader.tsx`, `LandingPricing.tsx`.
- **Comportamento**: Carregamento em ~92ms a 207ms. Alvos de toque medidos via `agent-browser` resultaram em `undersizedCount: 0`. Preços R$ 49/mês (Plano Base) e R$ 79/mês (Plano Completo) estritamente alinhados a `docs/PRECOS.md`.

### B. Rota `/login` — Classificação: MELHORAR
- **Arquivo**: `app/login/page.tsx:1`.
- **Impacto**: Duplicação de superfície de login entre `/login` (conversion) e `/dashboard/login` (dashboard T2). Necessário unificar na rota canônica acordada pela coordenação (F-02).
- **Provedor SMTP**: `lib/email.ts:14` falha com código 550 para e-mails que não sejam a conta do proprietário da API Key no Resend (`francatorresmatheus@gmail.com`). Requer domínio próprio configurado no Resend para liberação de clientes externos reais.

### C. Rota `/onboarding` — Classificação: BLOQUEIA (F-01)
- **Arquivo**: `components/onboarding/StepAccount.tsx:36` e `components/onboarding/OnboardingFlow.tsx:135`.
- **Reprodução**: O usuário completa os 4 passos (cadastra salão, define corte de R$ 50 com sinal de R$ 20, define expediente 9h-19h) e ativa seus 7 dias grátis. O sistema dispara o e-mail, mas o payload (`businessName`, `slug`, `serviceName`, `priceCents`, `depositCents`, `openDays`, `opensAt`, `closesAt`) permanece unicamente no `localStorage` do navegador do cliente. Não há chamada para o backend de T1 para criar o registro nas tabelas `business` e `service`.
- **Impacto**: Impede a conclusão da jornada do primeiro cliente pagante (do onboarding ao primeiro agendamento real).
- **Dependência**: T1 implementar endpoint de provisionamento inicial pós-autenticação.

---

## 3. Resumo Executivo

1. **Rotas Visuais (`/`, `/login`, `/onboarding`)**: 100% navegáveis, responsivas em 375px e desktop, sem overflow horizontal, alvos táteis >= 44px.
2. **Autenticação**: Operacional com Resend SMTP para o e-mail autorizado da conta; falhas reais retornam erro observável sem simulação falsa.
3. **Bloqueador Principal**: Persistência do negócio pós-onboarding (F-01) bloqueia ativação real até T1 fornecer rota de provisionamento.
