# Checkpoint para retomada — CODEXADO / T2

Preparação somente. Nenhum terminal, servidor ou sessão foi reiniciado. Operações anteriores terminaram; nenhum ask está pendente neste terminal.

## Identidade e retomada exata

- Conversa/sessão Codex: 01a101ad-f294-7640-b01b-3d7240541bea (CODEX_THREAD_ID e CODEX_SESSION_ID coincidem).
- Terminal Maestri: b0576a48-4b50-414c-8aeb-72ca9cf17fa1; nome CODEXADO; Maestro habilitado pelo humano.
- Modelo efetivo: gpt-6.1-sol; raciocínio low; provider caveman; service_tier default; aprovação never; sandbox danger-full-access; processo iniciado com --no-daemon, sem profile.
- Evidência: session_meta e último turn_context do rollout /var/home/matheus/.codex/sessions/2026/10/03/rollout-2026-10-03T09-12-22-01a101ad-f294-7640-b01b-3d7240541bea.jsonl; opções não secretas conferidas no processo/configuração; sintaxe conferida em codex resume --help.
- Comando nativo (registrado, NÃO executado):

```bash
codex resume 01a101ad-f294-7640-b01b-3d7240541bea --model gpt-6.1-sol -c 'model_provider="caveman"' -c 'model_reasoning_effort="low"' -c 'service_tier="default"' --sandbox danger-full-access --ask-for-approval never --no-daemon --cd /var/home/matheus/projetos/agenda-dashboard
```

## Missão, branch e estado local

- T2: dono do dashboard real. T1: backend/auth/banco/Pix; T4: booking/tokens/compartilhados; T5 Trilha: conversão/onboarding; T3 CODEFICADO: QA; Prisma: auditoria UX; Codex Revisor e cursor-tech-lead: revisão.
- Worktree: /var/home/matheus/projetos/agenda-dashboard; branch feat/dashboard.
- HEAD: 9906d85d5cff0d96cf5f8a1027b64767fe2a38da.
- Alterações existentes NÃO commitadas: docs/backlog.md (10 linhas adicionadas); pasta docs/evidencias/dashboard-polish/ não rastreada, com imagens e visual-results.json. Preservar; não atribuir autoria nem descartar.
- Commits recentes: 9e24951 (identidade do login), 2d1e320 (diagnóstico origem), 96ac512 (mobile dashboard e UI Pix), 90c460c/9906d85 (checkpoints de comunicação).
- Nenhuma alteração de código de produto nesta preparação.

## Entrega frontend existente

- 9e24951: app/dashboard/login/page.tsx; components/dashboard/login-form.tsx; login-form.module.css; tests/e2e/dashboard-login.spec.ts e dashboard-login.config.ts.
- Marca Agenda, CTA lime/pill, paleta forest, Plus Jakarta Sans/Inter via next/font limitados ao login. Globals/components UI compartilhados não alterados. authClient.signIn.magicLink e callbacks /dashboard e /dashboard/login?error=link preservados.
- Loading anuncia espera e impede reenvio; erro recebe foco; sucesso só após resposta aceita. Nenhuma simulação de sucesso no produto. Casos HTTP controlados são somente provas de UI.
- Screenshots versionados: docs/evidencias/dashboard-login-style/login-{375,390,1280}-{light,dark}.png e login-error-real-375-light.png (input mascarado).
- Relatório: docs/evidencias/dashboard-login-style/README.md.
- UI Pix (96ac512): configurações consome GET/PUT/DELETE /api/businesses/{businessId}/pix-key; segredo não vai para React state/storage/log; campo limpa após gravação. Endpoint T1 commit 5087716 ainda não integrado nesta branch. QR e confirmação aguardam decisão.

## Provas e limites reais

- Última execução sobre o código do login entregue: pnpm lint passou sem warnings; pnpm typecheck passou; pnpm test 73/73, 7 arquivos.
- pnpm exec playwright test --config tests/e2e/dashboard-login.config.ts: 8/8 passaram em 4,5s, servidor 3343 preservado. Layout em 375/390/1280, claro/escuro, sem overflow; alvos >=44px; teclado; estados e callbacks. Respostas de sucesso/falha do teste de estados são interceptadas, não prova SMTP.
- Browser confirmou Plus Jakarta Sans e Inter carregadas. Novo envio real retornou 403 INVALID_ORIGIN, alerta focado; não criou sessão.
- Causa comprovada: processo 3343 está configurado com BETTER_AUTH_URL=http://127.0.0.1:3342. Origem configurada teve diagnóstico HTTP 200; não se alegou novo arquivo SMTP entregue.
- Dashboard autenticado/CRUD: prova histórica c16fadd + QA 34c4252; NÃO revalidada após os últimos ajustes por bloqueio de login. Screenshots de login não provam páginas autenticadas.
- Endpoint Pix: 404 na porta 3343; rota ausente do build desta branch. Integração com backend pendente.
- Build anterior passou em 96ac512 antes de extrair PixKeyForm; não há novo build alegado de 9e24951. pnpm test:e2e geral falhou ao tentar iniciar outro next dev; usar config focada sobre servidor existente, sem matar processo.
- Nenhuma revisão visual/técnica nova de 9e24951 foi aprovada. Recebimento do protocolo pelo Revisor não equivale a revisão do código.

## Maestri — operação atual e bloqueios

- Humano pediu resolver conexões sem criar/reiniciar/renomear terminais ou alterar missões. Transporte debug OK 200.
- check alcançou CODEFICADO, Antigravidade, Codex Revisor, Prisma e cursor-tech-lead. Isso NÃO demonstra quota disponível.
- T1 Codex conectado, ID 61670b9f-32f6-47d9-b19c-4a3dc19e8ae7. Há dois terminais chamados Codex: ask falha Multiple terminals named 'Codex' found (2); check Codex retorna No connection. check com ID não é aceito.
- Trilha, ID 7262b89a-d012-4715-a0a7-3e3579d9c649, identificado pelo próprio cursor-tech-lead. Aparece nas conexões indiretas. connect CODEXADO–Trilha por nome e ID foi recusado: No connection to 'Trilha'. You can only target what's wired into your team tree. Maestro não elimina essa restrição.
- Nota Varredura — Caveman ultra conectada com sucesso ao Codex Revisor. Bloco Operação Maestri (linhas 1–26) enviado e recebimento confirmado; sem nova revisão/implementação solicitada.
- Não modificar o aplicativo Maestri, arquivos de estado, identidade do chamador ou permissões para contornar bloqueios. Nenhum arquivo do aplicativo foi alterado.
- Próximo responsável para conexão: humano/operador do canvas faz ligação direta CODEXADO–Trilha e resolve nomes homônimos Codex, preservando sessões. Depois validar somente os canais afetados e entregar o handoff 9e24951 ao coordenador/Trilha.

## Regras e skills

- Português BR, Caveman ultra nas mensagens; documentos/código claros. AGENTS.md já lido. Próxima retomada deve manter missão e consultar somente regras pertinentes; sem varredura ampla ou checks repetidos sem causa.
- Protocolo Operação Maestri aplicado: dono único, TAREFA/ESCOPO/PRONTO/DEVOLVA, provas por commit/URL, sem sucesso fictício. Não carregar histórico da nota.
- Sem merge/push, sem editar outra worktree, sem relaxar auth/origem, sem criar agentes, sem contornar quota. Não usar --last/--continue, /clear ou /reset.
- Skills frontend-design, vercel-react-best-practices e web-design-guidelines agora constam no catálogo atualizado e têm SKILL.md em /var/home/matheus/.codex/skills/ (links para /var/home/matheus/.agents/skills/). Carregar somente quando pertinentes, preservando Next instalado, tokens e contratos.

## Processos e portas — preservar

- 3343: dashboard Next dev, PID 627597.
- 3342: servidor de verificação anterior, PID 625048.
- 3001: preview booking, PID 728632.
- 3005: conversão, PID 597446.
- 25242: SMTP sintético local, PID 613429.
- 55442: PostgreSQL sintético local, processo pasta.avx2 PID 166054.
- Diretórios dos processos conferidos nesta preparação:
- PID 627597: /var/home/matheus/projetos/agenda-dashboard
- PID 625048: /var/home/matheus/projetos/agenda-dashboard/.next/standalone (deleted)
- PID 728632: indisponível no momento do checkpoint
- PID 597446: indisponível no momento do checkpoint
- PID 613429: /var/home/matheus/projetos/agenda-dashboard
- PID 166054: /

Não parar servidores, banco, SMTP, portais ou agentes. Revalidar existência dos processos somente se necessário após retomada.

## Próximo passo após retomada

1. Confirmar conversa exata, cwd/branch/HEAD e preservar as alterações locais acima.
2. Receber instrução do humano após reinício coordenado; não reiniciar automaticamente.
3. Se conexões já tiverem sido corrigidas no canvas, validar canais afetados uma vez e entregar commit 9e24951/screenshot ao coordenador e Trilha, sem pedir nova implementação.
4. Login real permanece prioritário: operador/T1 alinha URL/origem na inicialização coordenada; T3 repete login SMTP e dashboard autenticado. T2 não altera backend nem substitui autenticação por bypass.
