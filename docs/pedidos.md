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
- Nenhuma edição foi feita na worktree ou rotas de backend do Terminal 1 ou Terminal 2.
- O modo preview funciona 100% offline em desenvolvimento via `pnpm dev`.
