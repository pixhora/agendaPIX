# Checkpoint de retomada — Codex Revisor

## Identidade e retomada

Sessão/conversa Codex exata: `01a0ff59-407e-79c2-bc27-bf77fab2c97a` (CODEX_THREAD_ID e CODEX_SESSION_ID coincidem).
Terminal Maestri: `Codex Revisor`; ID `3452106b-8cb4-4ac6-9677-ffd8dbb06f87` (não é o ID da conversa).
Registro: `/var/home/matheus/.codex/sessions/2026/10/02/rollout-2026-10-02T22-20-34-01a0ff59-407e-79c2-bc27-bf77fab2c97a.jsonl`.
Último turn_context verificado: modelo `gpt-6.1-sol`, effort `low`, approval `on-request`, sandbox `workspace-write`, rede restrita. Comando nativo validado por `codex resume --help`:

```bash
codex resume 01a0ff59-407e-79c2-bc27-bf77fab2c97a -C /var/home/matheus/projetos/agenda-review -m gpt-6.1-sol -c 'model_reasoning_effort="low"' -s workspace-write -a on-request
```

Não executar nesta preparação. Não usar --last/--continue, /clear ou /reset. Configuração global, plugins e permissões persistidas devem permanecer iguais; nenhum modelo ou perfil novo autorizado.

## Missão e fronteiras

Revisão técnica somente leitura de backend/painel: auth, sessão, tenant, validação, centavos, transações, concorrência, assinatura/idempotência de webhook e erros sem dados sensíveis. Não implementar código dos autores; não duplicar QA visual de CODEFICADO/Prisma. Sem merge/push. Português BR Caveman ultra.
Worktree `/var/home/matheus/projetos/agenda-review`, branch `feat/review`, HEAD `d462419f61f50515d3c5608c622551580ba85ee2`.

## Alterações locais preservadas

```
## feat/review
 M AGENTS.md
 M docs/pedidos.md
?? docs/reproductions/
?? docs/review-dashboard-2026-10-03.md
?? docs/review-f54803f.md

```
AGENTS.md foi alterado anteriormente por pedido explícito do humano para ajustar tabela; instruções operacionais atuais posteriores prevalecem. Não reescrever nem descartar. Docs de revisão e reprodução ainda não commitados.

## Entregas e decisões

- Backend f54803f994093d51bce7a51ae4afb82c251a5406 NÃO aprovado. logAuthEvent seguro não impede better-call 1.4.0 router.mjs:93 de publicar Error bruto após falha SMTP pelo handler real. Codex/T1 assume correção. Aguardar entrega explícita de commit corrigido; não procurar ou aprovar automaticamente HEAD novo.
- Reprodução original `/tmp/agenda-review-f54803f/tests/unit/reviewer-auth-error.test.ts`; cópia durável `/var/home/matheus/projetos/agenda-review/docs/reproductions/reviewer-auth-error.test.ts`. Imports da cópia durável pressupõem copiar para tests/unit de uma cópia isolada do backend.
- Evidência `/var/home/matheus/projetos/agenda-review/docs/review-f54803f.md`. Teste callback original passa; teste handler real falha ao encontrar marcador sintético em Error.stack nos argumentos do console. Resposta HTTP 500 não expõe marcador. Nenhum dado real foi usado.
- Painel c16faddb5fdbf3db176b8bd33a3b7c9881c001df recebeu OK técnico para alterações específicas do painel: tenant/sessão/Zod/centavos/lock/estados/persistência. Não significa produção aprovada: auth preexistente continua bloqueado. Oito arquivos conferidos por SHA-256 com leitura anterior.
- Contrato Server Components/Server Actions aprovado por T1, docs/CONTRATOS.md:71 no painel. Não exigir REST duplicado. CODEXADO mantém autoria painel, T4 tokens compartilhados.
- Relatório `/var/home/matheus/projetos/agenda-review/docs/review-dashboard-2026-10-03.md`; docs/pedidos.md atualizado. Próxima revisão só delta e riscos afetados.

## Provas e limites

Executado em cópia /tmp do backend: regressão auth original passa, handler com Error sintético falha. Reprodução adicional com config antiga painel confirmou vazamento. Erros Error não devem ser serializados apenas por JSON.stringify (resulta {}). Inspecionar message/stack/cause.
Gate documental git diff --check passou. Não repetidos gates gerais/DB/browser durante revisão do painel. Autor informou lint/typecheck/build exit 0, 73 unitários/7 arquivos e 3 PostgreSQL/1 arquivo; são resultados do autor. Browser histórico 46 checkpoints em docs/VERIFICACAO-T2-2026-10-03.md, não execução nova. Peso gzip 162233–164008 bytes não é waterfall.
Leitura de tenant, lock de reservas, exclusão PostgreSQL e webhook fake não encontrou novos bloqueios; integrações não repetidas. Fake/Preview não comprovam gateway bancário nem produção.

## Comunicação e processos

maestri list antes de contato. Peers observados Codex, CODEXADO, CODEFICADO. Codex direto falha por dois homônimos, apesar de list mostrar um. Não repetir prompt; reportar bloqueio real. Relatórios encaminhados por maestri ask CODEXADO; envio não equivale a resposta/repasse ao T1.
Chamadas ask anteriores tinham handles locais 85894, 85163, 31730 sem conclusão capturada. Não reenviar; usar check apenas se necessário para resultado. Nenhuma operação de escrita em produto em andamento. Nenhum servidor, browser ou banco iniciado pelo revisor; nenhuma porta reservada por ele. Porta 55442 é DB sintético do autor; estado/propriedade não alterados pelo revisor. Diretório /tmp/agenda-review-f54803f preservado.

## Protocolo e skills

Bloco Operação Maestri recebido do humano; dono único, handoff TAREFA/ESCOPO/PRONTO/DEVOLVA, checkpoint, provas reais, revisão por risco, sem buscas amplas/gates repetidos sem causa. Skills confirmadas no catálogo e acessíveis: `/var/home/matheus/.codex/skills/{investigate-first,security-best-practices,verify-and-stop}/SKILL.md`; carregar somente pertinente. Maestri e Caveman lidos anteriormente. OpenAI Docs consultada nesta preparação para comando de retomada; comando/modelo confirmados localmente, não por hipótese.

## Pendências e próximo passo

Aguardar commit corrigido de auth entregue pelo responsável. Revalidar apenas boundary do handler/adapter e riscos de sessão, sem novos gates gerais desnecessários. Critério: resposta segura, nenhum token/SQL/PII/stack sensível em logs, autenticação e recuperação preservadas. Registrar resultado e devolver ao autor por endereço inequívoco. Não iniciar implementação nem revisão ampla enquanto espera.

Preparação concluída; sessão não reiniciada. Este checkpoint não contém segredos.
