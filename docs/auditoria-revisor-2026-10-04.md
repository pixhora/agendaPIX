# Auditoria técnica atual — 2026-10-04 — Codex Revisor

## Identidade e escopo

Cwd: `/var/home/matheus/projetos/agenda-review`; branch `feat/review`; HEAD `d462419f61f50515d3c5608c622551580ba85ee2`. Árvore suja preservada: AGENTS.md e docs/pedidos.md modificados; docs/reproductions, review-dashboard-2026-10-03.md e review-f54803f.md não commitados. Sem rebase, implementação, merge, push ou deploy.
Backend inspecionado: `0d6858fa9f65a1fac9b5dbe98a7945051138a469`; alterações locais apenas documentais/artefatos observados, sem delta em auth/email/launcher contra HEAD. AGENTS integral e seções atuais de EQUIPE/CONTRATOS/PROGRESSO consultados. Documentos servem para ownership; conclusões abaixo usam código atual e teste executado.

## Estado

- Auth/SMTP: PARCIAL; logging do handler QUEBRADO. Configuração atual não mudou desde f54803f; correção do vazamento ainda AUSENTE. Não se aprova produção.
- Tenant/validação/concorrência/webhook fake: PARCIAL em homologação, sem novos defeitos encontrados na leitura. Diff entre f54803f e HEAD não muda bookings/service, payments/webhook/index, auth ou email. Proteções anteriormente lidas permanecem; testes integrados não repetidos.
- Armazenamento da chave Pix: PARCIAL na revisão. Rotas exigem sessão/origem; serviço autoriza businessId e devolve máscara; cifra possui teste passando. Chave armazenada não equivale a pagamento confirmado.
- Gateway/cobrança bancária: MOCK; seleção atual só aceita fake e bloqueia produção.

## Pendências priorizadas

1. **BLOQUEIA — vazamento auth atual.** `agenda-backend/lib/auth.ts:16`, `app/api/auth/[...all]/route.ts:10`; causa `better-call/dist/router.mjs:93`. Reprodução: POST magic link no handler real, stub somente persistência, envio rejeita com Error sintético; resposta 500 segura, console publica mensagem/stack. Teste focado falhou hoje. Impacto: credenciais/PII de erros podem chegar aos logs. Dono Codex/T1; dependência integração CODEXADO após revisão. Pronto: corrigir boundary sem relaxar autenticação, incorporar teste handler SMTP/adapter, zero marcador em message/stack/cause e respostas. f54803f continua rejeitado.
2. **PARCIAL — prova SMTP operacional.** `lib/email.ts:6` e `:14`. Código envia por nodemailer com timeout; nesta revisão envio foi simulado, não homologado externamente. Reprodução de aceitação: SMTP de teste autorizado entrega link, consumo único, expiração, falha e recuperação em HTTPS sem logs sensíveis. Impacto: login real pode ficar indisponível mesmo com HTTP 200. Dono Codex/T1; depende de SMTP autorizado e correção 1. Pronto: prova sanitizada do fluxo real e regressões pertinentes; nenhuma credencial solicitada/copied nesta auditoria.
3. **PARCIAL — revisão HTTP/integração das novas rotas de chave Pix.** `app/api/businesses/[businessId]/pix-key/route.ts:9/:14/:29`, `lib/pix-key/service.ts:10/:17/:33`. Sessão/origem/autorização presentes na leitura, cifra testada; HTTP/DB não executados pelo revisor nesta rodada. Impacto: regressão nessa fronteira poderia expor/alterar chave de outro dono. Donos T1 (autor), Codex Revisor (revalidação delimitada); depende de banco sintético exclusivo e entrega da prova do autor. Pronto: 401 sem sessão, 403 origem inválida, 404 tenant alheio; GET/PUT/DELETE sem chave/ciphertext/log bruto; recuperação e preservação de dados. Não foi encontrado vazamento dessas respostas nesta leitura; não classificar ausência de prova como defeito confirmado.
4. **MOCK — homologação da confirmação financeira real.** `lib/payments/index.ts:6`, `lib/payments/webhook.ts:24/:28/:38`. Reprodução: configuração aceita apenas PAYMENT_PROVIDER=fake; NODE_ENV production retorna indisponibilidade. Impacto: MVP não cobra/confirma Pix bancário. Dono Codex/T1 e humano; depende de escolha/autorização do gateway e regras materiais, não definidas pelo revisor. Pronto: implementação escolhida entregue, autenticação oficial, centavos/tenant/idempotência e concorrência comprovados em teste; prova bancária real separada autorizada. Revisor permanece revisor, não implementa gateway.

## Comando e resultado executados

Snapshot git archive 0d6858f em `/tmp/agenda-review-audit-2026-10-04`, sem .env e usando dependências instaladas. Reprodução preservada copiada de docs/reproductions/reviewer-auth-error.test.ts.

`node /var/home/matheus/projetos/agenda-backend/node_modules/vitest/vitest.mjs run --root /tmp/agenda-review-audit-2026-10-04 tests/unit/auth-logger.test.ts tests/unit/reviewer-auth-error.test.ts tests/unit/http.test.ts tests/unit/payments.test.ts tests/unit/pix-key-crypto.test.ts`

Resultado: exit 1; 31 passaram, 1 falhou; 4 arquivos passaram, 1 falhou. Única falha: handler publica Error sintético via # SERVER_ERROR. Callback logger, erros HTTP, regras/assinatura fake e cifra passaram. Teste não enviou email, não abriu banco, não usou dados reais; nenhum processo alheio interrompido.

Pendentes: SMTP operacional, integrações HTTP/DB novas, sessão/adapter após correção e gateway bancário. Lint/typecheck/build gerais e E2E CODEFICADO não executados nem alegados. git diff --check documental executado. Sem servidor ou porta criada nesta auditoria.

## Próximo passo

Hermes consolida e delimita tarefas dos autores. Revisor revalida commit corrigido e riscos afetados após entrega. Não implementar nem repetir gates sem alteração, falha ou risco novo. Envio único solicitado por maestri ask Hermes; confirmação de envio/recebimento registrada separadamente, sem inventar integração.
