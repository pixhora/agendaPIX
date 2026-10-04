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

## 2026-10-03 — Terminal 4 para CODEFICADO (T3) e Trilha (T5)

- Commit `6d12ccf`: régua de datas totalmente aprovada em QA pelo CODEFICADO (4/4 cenários em 375px e 1280px, claro e escuro).
- P1 (contraste 10,64:1) e P2 (foco sem recorte, scrollbar oculta e fades dinâmicos) encerrados.
- BookingFlow público integrado aos contratos de disponibilidade, reservas e verificação Pix.

## 2026-10-03 — Terminal 4 / Terminal 3 para Terminal 1 e Coordenador: Medição de Performance Mobile

- Commit testado: `9791651`.
- Medição T3 (perfil móvel simulado 1,6 Mbps / 750 kbps / 150 ms):
  - Dev :3001: mediano 18,15s; JS transferido 3,3 MB.
  - Produção :3006: mediano 1,55s (91% mais rápido); JS transferido ~160 KB (95% menor).
  - 18 amostras com HTTP 200 e zero erros.
- T3 aguarda definição da URL pública otimizada apontando para a produção (:3006) para medição final externa.

## 2026-10-03 — Trilha (T5) para CODEFICADO (T3) via Terminal 4: Dados para QA de Conversão

- Commit para teste: `4fe0e1d` (inclui `e9dfba4` dos preços R$49/R$79, `e1877b4` da acessibilidade do login e melhorias de onboarding).
- Branch / Worktree: `feat/conversion` em `/var/home/matheus/projetos/agenda-conversion`.
- Servidor ativo: `http://127.0.0.1:3005` (porta 3005).
- Rotas principais para QA:
  1. `/login`: envio de magic link, validação de e-mail, `aria-invalid` / `aria-describedby` dinâmicos em erro e fallback transparente para dev.
  2. `/onboarding`: 4 passos, persistência do rascunho e do passo ativo no reload, e alertas inline com `role="alert"` no Step 2 (sinal > total) e Step 3 (fechamento <= abertura / dias).
  3. `/` (Landing): CTA "Entrar" visível no mobile 375px linkando para `/login`, e cards de preços R$ 49 e R$ 79.
- Gates locais T5: lint 0 warnings, typecheck 0 erros, 68/68 testes unitários aprovados.

## 2026-10-04 — Terminal 4 para CODEXADO (T2) e Trilha (T5): Especificação dos Tokens de Movimento (A1)

Conforme o item A1 do `PLANO_ANIMACOES.md`, o Terminal 4 padronizou os tokens de movimento e classes CSS para compartilhamento entre as frentes:

1. **Tokens CSS (`:root` e dark mode)**:
   - `--duration-feedback: 120ms` (toque, seleção de itens, scales discretos).
   - `--duration-opening: 180ms` (abertura de menus/diálogos, fades de rolagem).
   - `--duration-step: 240ms` (transição entre passos de formulário/fluxo).
   - `--ease-standard: cubic-bezier(0.16, 1, 0.3, 1)` (desaceleração natural).

2. **Classes Utilitárias (`@layer utilities`)**:
   - `.transition-feedback`: 120ms para hover/active/cores/transform. Usar `active:scale-[0.98]` ou `active:scale-[0.99]`.
   - `.transition-opening`: 180ms para fade e revelação.
   - `.transition-step`: 240ms para sincronia de barra de progresso.
   - `.animate-step-in`: 240ms com translateY(6px -> 0) e opacidade 0 -> 1 para novos passos.
   - `.animate-confirm-pop`: 240ms com escala 0.96 -> 1 para confirmação única.

3. **Invariantes Obrigatórias**:
   - `prefers-reduced-motion: reduce`: zera durações para `0s` e remove deslocamentos (`transform: none !important`).
   - Preservar estado de formulários (não desmontar dados ao voltar/avançar).
   - Nenhum feedback de sucesso fictício (especialmente em Pix ou salvamento de dados) antes da resposta real do servidor.

Documentação detalhada disponível em `docs/design-tokens.md` (Seção 7). T2 (A2 - Painel) e T5 (A3 - Landing/Onboarding) podem utilizar esses padrões diretamente.
