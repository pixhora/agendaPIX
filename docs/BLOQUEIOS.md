# Bloqueios e Dependências Externas (T5)

- **Data de Registro**: 2026-10-04
- **Área**: Landing, Onboarding, Conversão (`agenda-conversion`)
- **Status da Operação**: Ativo

---

## 1. Bloqueio Externo SMTP: Domínio Próprio no Resend

- **Classificação**: **BLOQUEIA** (para clientes externos e primeiro cliente pagante real)
- **Causa Raiz**:
  - O runtime utiliza as credenciais aprovadas do provedor Resend (`agenda-booking-ui/.env`).
  - Em modo de teste (sem domínio próprio verificado no dashboard do Resend), o serviço autoriza disparo de e-mails **única e exclusivamente** para o endereço da conta do desenvolvedor (`francatorresmatheus@gmail.com`).
  - Qualquer tentativa de envio para endereço de cliente final ou outro prestador de serviço retorna erro SMTP `550 You can only send testing emails to your own email address...` (`lib/email.ts:14`).
- **Natureza do Bloqueio**:
  - **Decisão e credencial do humano**, NÃO é problema de código.
  - Não pode ser resolvido com refatoração ou mock no frontend.
- **Condição de Desbloqueio**:
  - O humano configurar e verificar um domínio próprio no painel do Resend (`resend.com/domains`) e atualizar a variável `SMTP_FROM` para um remetente do domínio verificado (ex: `Agenda <contato@seudominio.com.br>`).

---

## 2. Bloqueio Funcional F-01: Provisionamento de Negócio pós-Onboarding

- **Classificação**: **BLOQUEIA** (para jornada ponta a ponta do primeiro cliente pagante)
- **Causa Raiz**:
  - `components/onboarding/StepAccount.tsx:36` coleta dados completos do estabelecimento (nome, slug, primeiro serviço com preço/sinal em centavos e horários de expediente), mas não há endpoint backend autenticado para persistir essas informações nas tabelas `businesses`, `services` e `business_hours` do PostgreSQL de T1.
- **Preparação Realizada por T5**:
  - Módulo `lib/provisioning.ts` criado com Zod schema e helper de chamada `provisionBusiness(data: OnboardingData)`.
  - Contrato documentado e registrado em `docs/pedidos.md`.
- **Condição de Desbloqueio**:
  - T1 (Backend) implementar e publicar o endpoint autenticado `POST /api/onboarding` conforme especificação.

---

## 3. Dependência de Alinhamento F-02: Rota Única de Login

- **Classificação**: **MELHORAR**
- **Causa Raiz**:
  - Rota de login em conversion é `/login`, enquanto no painel do dono é `/dashboard/login`.
- **Preparação Realizada por T5**:
  - Componente canônico reutilizável `components/auth/LoginForm.tsx` extraído e documentado em `docs/LOGIN_CANONICO_T2.md`.
- **Condição de Resolução**:
  - Decisão de arquitetura e adoção do `LoginForm` pelo CODEXADO (T2) no dashboard.
