# Auditoria T2 para Hermes — 2026-10-04

## Checkpoint

CODEXADO/T2. Cwd `/var/home/matheus/projetos/agenda-dashboard`; branch `feat/dashboard`; HEAD `daf70ee8a9944ff42e47664eda4d64310e735483`. Status inicial: `M docs/backlog.md`, `?? docs/evidencias/dashboard-polish/`; preservados. Sem rebase, alteração funcional, merge/push/deploy ou reinício de processo. AGENTS.md integral e seções pertinentes de EQUIPE/CONTRATOS/PROGRESSO lidos.

## Estado atual

- **QUEBRADO operacional:** servidor esperado em 3343 recusa conexão nesta rodada. Não há prova atual de login/CRUD no browser.
- **PARCIAL integrado:** agenda dia/semana e lista de clientes usam consultas Drizzle reais; serviços/preços/horários usam Server Actions reais. Código implementa sessão do servidor, filtro de tenant, Zod, centavos e transação/lock para horários. Não há REST administrativo paralelo. Esses mecanismos estão completos no escopo de código inspecionado; execução atual está bloqueada pelo servidor.
- **PARCIAL Pix:** formulário real GET/PUT/DELETE existe, com máscara, pending, feedback e limpeza do input password. Backend dessa rota está **AUSENTE nesta worktree**. Testes anteriores controlados de UI não comprovam persistência Pix integrada.
- **AUSENTE:** editar cliente, operar status de reserva e configurar dados do negócio não têm ações/telas nesta entrega. São lacunas de produto sujeitas a contrato/priorização, não bugs automaticamente bloqueadores do MVP de leitura.
- **MOCK:** nenhuma fonte mock encontrada nos leitores do dashboard inspecionados. Pix bancário/Preview não devem ser apresentados como produção; gateway real pertence a T1 e não foi auditado nesta rodada.

## Pendências priorizadas

1. **P0 — Disponibilidade e prova integrada.** Referência `lib/dashboard/session.ts:6`, entrada `/dashboard/login` em 3343. Reprodução: `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 http://127.0.0.1:3343/dashboard/login`; observado `curl: (7) Failed to connect ... Could not connect to server`, HTTP000. Esperado HTTP200. Impacto: painel e QA indisponíveis. Dono: T2/operador; dependências: launcher/ambiente sintético e origem Better Auth correta, sem relaxar segurança. Pronto: 3343 saudável; login SMTP e CRUD reais com sessão normal; preservar portas/sessões alheias. Divergência antiga3343/3342 não foi revalidada agora.
2. **P1 — Integrar API Pix existente de T1.** `components/dashboard/pix-key-form.tsx:26`, `app/dashboard/(owner)/settings/page.tsx:11`. Reprodução estática: `rg --files app/api | rg 'business|pix-key'` sem rota; formulário chama `/api/businesses/{id}/pix-key`. HTTP atual não executável por P0; 404 anterior é histórico. Impacto: estabelecimento não consegue concluir configuração Pix nesta branch isolada. Dono: T1/integrador para backend seguro, depois T2/QA para integração; dependências: commit final autorizado e contrato GET/PUT/DELETE de T1. Pronto: máscara GET, PUT/DELETE persistidos, tenant/same-origin, falha503 segura, nenhuma chave completa em resposta/state/storage/log, prova375px real. Não criar REST duplicado de serviços/horários.
3. **P2 — Coerência visual compartilhada ainda não integrada.** `app/globals.css:6` define primary azul `#1d4ed8`; login local tem identidade lime e T4 publica tokens distintos. Reprodução por inspeção dos tokens atuais; capturas anteriores não são prova atual. Impacto: login e painel parecem produtos diferentes. Dono: T4 para compartilhados por acordo, T2 para consumo local; dependências: pacote/commit de tokens aprovado e dono único. Pronto: identidade coerente em375/390/desktop claro/escuro, contraste/foco/toque preservados, sem editar globals em paralelo.
4. **P2 condicionado ao produto — Operação de clientes/reservas e dados do negócio.** `app/dashboard/(owner)/customers/page.tsx:10` oferece lista/ligação; `app/dashboard/(owner)/page.tsx:42` apresenta reservas; `app/dashboard/(owner)/actions.ts:15/28` exporta somente saveService/saveHours; settings:10/11 só funcionamento/Pix. Reprodução: abrir essas telas quando P0 resolvido; não existem comandos de editar cliente/status/configurar cadastro. Impacto: correções administrativas dependem de operação externa. Dono: humano/Hermes prioriza; T1 define ações/regras/autorização; T2 implementa UI apenas após contrato. Pronto: escopo comercial delimitado, regras de dinheiro/reversão aprovadas e teste tenant/persistência; se fora do MVP, registrar explicitamente como adiado.

## Comandos e evidências desta rodada

- `pwd`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`: checkpoint confirmado acima.
- `maestri list`: Hermes alcançável nominalmente; nenhum contato/conexão adicional criado.
- Inspeção com `rg`, `nl` e leituras de arquivos-alvo/dependências diretas; fontes: session/data/actions, quatro páginas do painel, formulário Pix, tokens locais e contrato aprovado.
- `pnpm test -- tests/unit/dashboard-status.test.ts tests/unit/dashboard-validation.test.ts`: wrapper executou a suíte inteira, **73/73 testes, sete arquivos, 1,08s**, exit0. Não declarar que foi execução restrita.
- `curl` acima: exit7/HTTP000. Nenhuma requisição de gravação, cobrança ou consulta de dados reais.
- Lint/typecheck/build/E2E não repetidos nesta auditoria sem alteração funcional. Resultados anteriores do A2 são históricos, não execução nova. E2E/login/CRUD/Pix reais atuais e revisão externa continuam pendentes.
- Pedido A4/A5 já enviado uma vez; handle antigo de espera não existe mais (`Unknown process id 61232`). Não reenviei nem aleguei aprovação.

Próxima ação: Hermes consolidar e delimitar tarefas. T2 aguardará dependências prontas antes de implementar; código de produto preservado.
