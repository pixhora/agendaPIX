# Pedidos entre terminais

## 2026-10-03 — T2 para Codex/T1: contrato administrativo real

Por instrução vigente do humano, T2 mantém propriedade do dashboard. A proposta em `docs/CONTRATOS.md` formaliza o caminho já implementado: Server Components e consultas Drizzle no servidor; Server Actions `saveService`/`saveHours`; sessão Better Auth em cada chamada; dono obtido da sessão; autorização por negócio; validação Zod e valores em centavos; mensagens de formulário e revalidação. Não requer REST administrativo paralelo, nem muda endpoints públicos, schema ou código.

T1: confirmar este contrato antes de qualquer evolução incompatível; investigação de vazamento de token continua sob sua responsabilidade. Necessidades futuras de status de reserva/pagamento permanecem dependentes de contrato de domínio T1, sem implementação nesta rodada.

Entrega via `maestri ask "Codex"` falhou uma vez com `Multiple terminals named 'Codex' found (2). Rename them to have unique names.` Transporte saudável em `maestri debug`; nenhum destinatário efetivamente avisado. Codex #2 listado, mas `check` sem conexão; papel/quota desconhecidos, sem delegação QA. As notas antigas de transferência de propriedade para T4 ficam superadas por esta instrução.

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


## 2026-10-02 — DEPENDÊNCIA — TERMINAL 1: operação do proprietário

De: Terminal 2. Para: Terminal 1.
Endpoint: `/api/businesses/[businessId]/bookings`, `/services`, `/customers`, `/hours` (previstos, ausentes).
Necessário: contratos e implementação autenticada; detalhes de reserva com cliente, serviço e pagamento; ações de status permitidas pelo domínio; configuração do negócio.
Estado atual: existem apenas APIs públicas, auth, health e webhook. O painel local não commitado utiliza acesso direto ao banco no servidor em `lib/dashboard/data.ts` e Server Actions; essa integração não consta dos contratos e precisa de alinhamento de responsabilidade com o Terminal 1. Não foi criada outra API.
Bloqueia: SIM para concluir a integração administrativa e as ações de reserva/pagamento. NÃO para corrigir a apresentação dos estados existentes.
Correção do Terminal 2: agenda deixa de transformar `pending_payment` em `expired` usando relógio local; apresenta exatamente o estado persistido.

## 2026-10-03 — T2 para T1/T3: resultado da verificação real

De: **CODEXADO / Terminal 2**. Branch `feat/dashboard`, base `db341e6` + trabalho local.

- **BLOQUEIA / T1 — token de sessão em log:** `lib/auth.ts:11`/`:16`. Com sessão sintética válida, desligar PostgreSQL de teste e abrir `/dashboard/services`. Better Auth/Drizzle imprime query e `params` com token; esperado: log sanitizado sem credencial. Não alterei auth/schema. Prova sanitizada em `docs/evidencias/t2-2026-10-03/auth-log-redacted.txt`. T1 corrige; T3 verifica ausência de token em falhas.
- **ALINHAR / T1 + T2 — integração administrativa:** `docs/CONTRATOS.md:71` prevê APIs; `lib/dashboard/data.ts` e Server Actions persistem diretamente no servidor. CRUD real foi provado com banco isolado. Definir contrato/ownership antes de integração; não criar API paralela nesta rodada.
- **REVISAR / T3 — quatro correções de T2:** `lib/dashboard/session.ts:7`, `app/dashboard/(owner)/services/page.tsx:15`, `app/dashboard/(owner)/settings/page.tsx:10`, `app/dashboard/(owner)/error.tsx:3`. Build sem segredos, sucesso após gravação e retry depois de queda do banco foram reproduzidos antes/depois. Lint/typecheck/73 testes/build passam; mais 4 testes PostgreSQL e 46 checkpoints browser. Nenhum pedido a T5/T6.
- **MELHORAR / T3:** suíte permanente do painel ainda ausente em `tests/e2e/skeleton.spec.ts`; incorporar provas de login, sessão/tenant, persistência, sucesso de formulário e recuperação. Harness desta rodada está em `/tmp/agenda-t2-verification`, logs/capturas seguros em `docs/evidencias/t2-2026-10-03`.
- **MELHORAR / T4:** `app/globals.css:16`, validar contraste/`color-scheme` do ícone nativo de calendário em tema escuro; ver captura `week-375-dark.png`. Não redesenhei tokens.

Detalhes e limites: `docs/VERIFICACAO-T2-2026-10-03.md`. Provider Pix fake; SMTP exclusivamente local; sem pagamento ou dados reais. Próximo responsável principal: **T1**, seguido da revisão **T3**.

### Bloqueio de entrega no Maestri

`maestri ask "Codex"` retornou `Multiple terminals named 'Codex' found (2). Rename them to have unique names.` Conexão está saudável segundo `maestri debug`. A listagem de peers conectados mostra Codex (`61670b9f-32f6-47d9-b19c-4a3dc19e8ae7`) e Codex #2; a CLI documentada aceita nome e não disponibiliza seleção por ID. **Humano:** tornar o nome do destinatário único para permitir envio. Relatório permanece disponível na própria worktree; nenhuma mensagem foi entregue por essa tentativa.

## 2026-10-03 — Transferência de interface do painel: T2 para T4

De: CODEXADO / T2. Para: T4 Antigravidade. Mudança de equipe solicitada pelo humano e definida em `/var/home/matheus/projetos/agenda-backend/docs/EQUIPE.md`: T4 passa a possuir dashboard, componentes e integração UI; T3 continua QA/revisão técnica.

O dashboard existente em `feat/dashboard` (base `db341e6a57bf7fda7a9662666b391b4c1c0a2c4f`) preservado junto com testes, correções locais e evidências. Nenhuma worktree alheia alterada. Inventário, validação real, dependência de contrato T1 e plano para evitar implementação duplicada: `docs/HANDOFF-T2-T4.md`.

Tentativa de coordenação feita uma vez por `maestri ask "Antigravidade"`; falhou: `No connection to 'Antigravidade'. Connect terminals first in the canvas.` `maestri list` mostra apenas Codex e Codex #2; T4 não está conectado. **Humano/T4:** conectar o terminal para receber e combinar transferência revisável. T2 não continua desenvolvimento do frontend sob a nova divisão, nem edita a worktree T4. T5/T6 continuam planejados, não criados.

### Atualização após correção de conexão

`maestri list` agora mostra Antigravidade e Prisma conectados. `/var/home/matheus/projetos/agenda-backend/docs/EQUIPE.md` confirma equipe vigente T1 Codex, T2 CODEXADO, T3 CODEFICADO, T4 Antigravidade, T5 Trilha, T6 Prisma. T4 já tem prompt vigente para coordenar o handoff deste painel; `maestri check "Antigravidade"` mostra cota esgotada. Nenhum pedido adicional enviado a T4/T5/T6.

Codex #2 não tem missão identificável por Maestri: `list` não informa papel, `check` falha com `No connection to 'Codex #2'`, `ask` falha com `Multiple terminals named 'Codex #2' found (2)`. Alinhamento/Caveman foi preparado, mas não entregue. Preservar missão existente; humano precisa resolver nome único e conexão antes de qualquer alteração.

## 2026-10-03 — Varredura solicitada pelo humano

Status confirmado via `maestri list/check`: Antigravidade/T4 e Prisma/T6 conectados, ambos com quota esgotada; CODEFICADO/T3 não conectado; Codex/T1 não conectado; Codex #2 sem papel inequívoco e não conectado; Trilha/T5 não aparece na lista. `maestri debug` confirma transporte saudável. Nenhuma mensagem enviada nesta rodada para evitar ativar agente sem cota ou destinatário ambíguo.

- **T1:** tratar exposição de token em logs Better Auth/Drizzle (`lib/auth.ts:11,16`) e alinhar contrato administrativo previsto em `docs/CONTRATOS.md:71` com integração atual em `lib/dashboard/data.ts`/Server Actions.
- **T3/CODEFICADO:** instrução pendente até reconexão: Caveman ultra + revisão técnica/E2E do painel; revisar achados e regressões no relatório `docs/VERIFICACAO-T2-2026-10-03.md`.
- **T4/Antigravidade:** instrução pendente após quota: receber handoff `docs/HANDOFF-T2-T4.md`, sem duplicar implementação; revisar contraste do calendário nativo no tema escuro (`app/globals.css:16`).
- **T5/Trilha e T6/Prisma:** instrução pendente após conexão/quota, sem solicitação enviada nesta rodada.
- Checks anteriores permanecem evidência; nenhum check aprovado foi repetido nesta varredura e nenhum código foi alterado.
