# Pedidos entre terminais

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

## 2026-10-02 — Terminal 4 para Terminal 2 e Codex: Modo Preview e Telas do Dono

O Terminal 4 implementou o **Modo Preview** (`/preview`, `/preview/landing`, `/preview/booking`, `/preview/dashboard`, `/preview/reservas`, `/preview/servicos`, `/preview/configuracoes`) com dados determinísticos fictícios do Studio Bella (São Paulo SP), sem depender de banco de dados, Better Auth ou provedores de pagamento.
Para respeitar estritamente a divisão de papéis (o dashboard real e rotas autenticadas pertencem ao Terminal 2 em `agenda-dashboard`):
- Os layouts, cartões de métricas, filtros de reservas e componentes visuais criados para o preview em `app/preview/dashboard`, `app/preview/reservas`, `app/preview/servicos` e `app/preview/configuracoes` estão à disposição do Terminal 2 para serem reaproveitados diretamente nas rotas reais `/dashboard/*`.
- O modo preview funciona 100% offline em desenvolvimento via `pnpm dev`.

## 2026-10-03 — Terminal 5 (Trilha) para Terminal 1 (Codex): Endpoint de Criação de Negócio (Onboarding)

O fluxo de Onboarding (`/onboarding`) coleta os dados essenciais para o primeiro negócio do usuário:
1. Negócio: `businessName` e `slug` (sanitizado em kebab-case).
2. Primeiro serviço: `serviceName`, `durationMinutes`, `priceCents` e `depositCents`.
3. Horários de funcionamento: `openDays` (array de inteiros 0-6), `opensAt` (HH:mm) e `closesAt` (HH:mm).
4. Conta do proprietário: `email` (autenticado via Better Auth Magic Link).

### Requisito Concreto para T1:
- **Rota proposta**: `POST /api/onboarding` (autenticado pela sessão do Better Auth)
- **Request Body**:
```json
{
  "businessName": "Barbearia do Silva",
  "slug": "barbearia-do-silva",
  "service": {
    "name": "Corte de Cabelo",
    "durationMinutes": 45,
    "priceCents": 5000,
    "depositCents": 2000
  },
  "hours": {
    "openDays": [1, 2, 3, 4, 5, 6],
    "opensAt": "09:00",
    "closesAt": "19:00"
  }
}
```
- **Response**:
  - `201 Created`: `{ "businessId": "uuid", "slug": "barbearia-do-silva", "status": "active" }`
  - `400 Bad Request`: validação Zod (slug inválido, horários inconsistentes, etc.)
  - `401 Unauthorized`: sem sessão Better Auth ativa
  - `409 Conflict`: slug já em uso por outro negócio
- **Impacto no Frontend (T5)**: Enquanto o endpoint não for disponibilizado, o frontend preserva os dados em `agenda_completed_onboarding_setup` no storage do cliente e exibe estados de espera honestos sem simular ativação inexistente.

