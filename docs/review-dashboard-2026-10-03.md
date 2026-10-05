# Continuidade da revisão técnica — painel e autenticação

Data: 2026-10-03. Autor: Codex Revisor, feat/review / agenda-review.

## Plano

1. Preservar a reprodução do handler real e encaminhar o caminho exato ao backend.
2. Revisar o painel existente, incluindo arquivos locais não commitados, sem repetir gates gerais aprovados.
3. Registrar achados, escopo, evidências e critérios; revalidar auth somente depois da entrega de commit corrigido.

## Base e limites

AGENTS.md integral e docs de backlog, contratos, progresso e EQUIPE.md do backend lidos. A instrução atual do humano prevalece sobre divisões antigas: CODEXADO mantém o painel; contrato Server Components/Server Actions aprovado por T1. Não exigir REST administrativo paralelo.

Painel: HEAD observado `db341e6a57bf7fda7a9662666b391b4c1c0a2c4f`, mais arquivos locais preexistentes não commitados. Portanto, não se atribui o código local apenas ao commit-base. Hashes abaixo identificam os arquivos efetivamente lidos. Nenhum arquivo dos autores foi alterado, nenhuma funcionalidade implementada e nenhum gate geral repetido. A alteração preexistente em AGENTS.md da própria worktree foi preservada, sem novas mudanças nela. Sem merge/push. Este relatório e a reprodução são documentos locais ainda não commitados.

## Bloqueia — autenticação, já assumido pelo backend

Arquivo: backend `lib/auth.ts:16`; painel `lib/auth.ts:11`; causa confirmada em better-call 1.4.0 `dist/router.mjs:93`. Responsável: Codex/backend; CODEXADO integra a versão final no painel.

Impacto: uma falha SMTP/banco pode publicar Error bruto, mensagem e stack contendo dados sensíveis. f54803f continua sem aprovação. Reprodução sanitizada e resultado da execução anterior estão em [review-f54803f.md](review-f54803f.md).

Caminho original preservado: `/tmp/agenda-review-f54803f/tests/unit/reviewer-auth-error.test.ts`.
Cópia durável: [reproductions/reviewer-auth-error.test.ts](reproductions/reviewer-auth-error.test.ts). Copiar para `tests/unit/` de uma cópia isolada do backend antes de executá-la; os imports são relativos ao projeto backend, não ao diretório de documentação.

Critério objetivo: falha SMTP e falha do adapter, atravessando handler real, retornam resposta segura; nenhum marcador sintético, token, SQL ou PII aparece nos argumentos de console, inclusive Error.message/stack/cause. Autenticação por link único, redirecionamentos e recuperação devem permanecer corretos. Teste callback sozinho não satisfaz o critério. Revalidação pendente da entrega explícita de commit corrigido; nenhum teste de f54803f repetido nesta rodada.

## OK na leitura — painel técnico

- `lib/dashboard/session.ts:7`: headers obtidos antes da inicialização de auth; owner vem da sessão por requisição. Server Actions `actions.ts:16` e `:30` repetem a autenticação antes de mutações.
- `lib/dashboard/data.ts:14`: autorização pelo dono; leituras filtram businessId; `:38` inclui tenant nos joins; `:48` restringe atualização ao serviço do próprio negócio. ownerId não é aceito do formulário.
- `lib/dashboard/validation.ts:26`: parseMoney separa parte inteira e casas decimais; Zod limita centavos à coluna integer. Sinal superior ao preço é rejeitado. `data.ts:48` altera somente serviço, preservando preço/sinal históricos das reservas.
- `lib/dashboard/data.ts:57`: substituição dos dias em transação com row lock do negócio; delete/insert restringem businessId. O lock protege escritores simultâneos de configuração; não se confunde com o advisory lock usado por reservas.
- `app/dashboard/(owner)/actions.ts:10`: erros desconhecidos retornam mensagem fixa de formulário, sem SQL ou stack. O bloqueio de logging da autenticação permanece separado e não foi resolvido pelo formulário.
- `services/page.tsx:15` e `settings/page.tsx:10`: keys estáveis preservam feedback após revalidação. `components/dashboard/forms.tsx:17` e `:37` mantêm estado do formulário, pending e feedback. `app/dashboard/(owner)/error.tsx:3` usa retry, conforme a versão Next instalada e a prova anterior do autor.

Não foi encontrado novo bloqueio verificável na lógica do painel neste recorte. Isso não aprova auth nem comprova produção. Gates e prova de browser/PostgreSQL anteriores são evidência histórica do autor em `agenda-dashboard/docs/VERIFICACAO-T2-2026-10-03.md`; não são execuções desta revisão. Auditoria visual e booking/Preview ficam fora deste trabalho.

## Melhorar — regressão permanente do painel

Arquivo: `tests/e2e/skeleton.spec.ts:3`, relacionado a `tests/integration/dashboard.test.ts:28` e `:39`. Responsáveis: CODEFICADO, em coordenação com CODEXADO, evitando duplicar o QA já em andamento.

A leitura confirma testes de isolamento/validação e prova temporária do autor com estados reais. A suíte permanente ainda não prova toda a jornada de salvar/revalidar/recuperar erro do painel. Incorporar as regressões existentes quando o QA assumir esse fluxo; não bloquear o backend por preferência visual e não apresentar os checkpoints temporários como testes versionados.

## Comunicação e comandos desta rodada

- `maestri list`: primeira tentativa bloqueada pelo sandbox. `maestri debug` executado antes da recuperação; list fora do sandbox identificou Codex Revisor e peers Codex, CODEXADO, CODEFICADO.
- `maestri ask Codex <caminhos e critério>`: falhou imediatamente, `Multiple terminals named 'Codex' found (2). Rename them to have unique names.` Mensagem não foi entregue ao T1. Debug fora do sandbox confirmou transporte saudável.
- `maestri ask CODEXADO <pedido de repasse ao T1>`: solicitação enviada; confirmação pendente no momento deste registro. Não reenviada nem atribuída como recebida pelo T1.
- Leituras com cat/rg/git status/git log: sem alterações nas worktrees dos autores. Painel permanece com árvore local preexistente.
- `git diff --check`: verificação documental; nenhum gate geral de produto executado.

## Arquivos do painel identificados por SHA-256

- `lib/dashboard/session.ts`: `2bf8bc5a8970a87005311e00e5df05fb96042853f988b65ba2408f7f6aac06fe`
- `lib/dashboard/data.ts`: `4c37b415dc051e61d370ce5762a07d737914174ee1c9855e653f059dea9a385e`
- `lib/dashboard/validation.ts`: `8dbc6d9c7dc29128047c54289f00109861e5c6d6c0ab5d8810807977d9d204fd`
- `app/dashboard/(owner)/actions.ts`: `e642726c178c0cd20072e53543a72612069ff9cb1e5f99cc53535c1b0e91976b`
- `app/dashboard/(owner)/error.tsx`: `d44775acb78a46f690a90c909695b0d74cc461d9250fae665b1252313403e2e5`
- `app/dashboard/(owner)/services/page.tsx`: `c8bdd0ca87edf4c5735f847055d483b6e2dba54af48ee53a8b6dba454a9f3a5d`
- `app/dashboard/(owner)/settings/page.tsx`: `a17b95d2ed139e69b05ccdc7c73be1adb31461e193e7439ac3474b90cbf20ab4`
- `components/dashboard/forms.tsx`: `bc6d7fc190f54dc2f1627b5366a578d31e621fa01a91cd2bdf4c43de30d4893d`

## Pendências

Receber commit corrigido do backend; executar somente prova focada da correção; CODEXADO integrar auth aprovado; receber entrega consolidada do painel para revisão vinculada a commit. Gateway real, SMTP externo, deploy HTTPS e fluxo bancário dependem das entregas de seus responsáveis. Fake/Preview não satisfazem produção. Nenhum novo gateway, preço, regra comercial ou texto legal foi definido nesta revisão.

## Entrega c16fadd — revisão vinculada ao commit

Checkpoint recebido: `c16faddb5fdbf3db176b8bd33a3b7c9881c001df`, feat/dashboard. Leitura via git show do commit, sem depender de alterações locais posteriores. Os oito arquivos do manifesto acima coincidem byte a byte com o commit (SHA-256 verificado). A árvore do autor possui somente docs/backlog.md modificado no momento da inspeção; esse documento local não integra a aprovação do checkpoint.

**OK no escopo do painel:** sessão, autorização por tenant, Zod, centavos, preços históricos e substituição transacional de funcionamento. Aplicam-se as referências e critérios acima. Também lidos `components/dashboard/shell.tsx:12` e `app/dashboard/(owner)/customers/page.tsx:9`: negócio inacessível não seleciona dados alheios, lista vazia oferece ação, clientes vêm da consulta autorizada. Formulários têm pending, erro, sucesso e estado local preservado; keys de edição são estáveis. Não foi encontrado novo bloqueio técnico introduzido por c16fadd. Contrato administrativo aprovado em docs/CONTRATOS.md:71; não há requisito de REST duplicado.

**Bloqueia produção, preexistente:** lib/auth.ts:11 ainda usa a configuração antiga; f54803f permanece rejeitado pela reprodução do handler real. Responsável Codex/backend, integração final CODEXADO. Critério: falhas reais do handler/adapter não publicam token, SQL, PII ou stack sensível; resposta e sessão permanecem corretas. Esta aprovação do código específico do painel não aprova auth nem produção.

**Melhorar:** tests/e2e/skeleton.spec.ts:3 não versiona a jornada completa do painel. Reprodução/validação desejada: login, salvar serviço e funcionamento, reload, falha e recuperação; conferir sucesso persistente e negar tenant alheio. Responsáveis CODEFICADO/CODEXADO. Provas temporárias históricas permanecem válidas apenas para a execução documentada.

Comandos desta passagem: git show --stat c16fadd; git status --short; git rev-parse HEAD; git show de arquivos específicos; comparação SHA-256 dos oito arquivos; maestri list precedido de debug após bloqueio de sandbox; git diff --check documental. Gates gerais e PostgreSQL não repetidos. Gates informados pelo autor: lint/typecheck/build exit 0, 73 unitários/7 arquivos e 3 PostgreSQL/1 arquivo. Não são resultados executados pelo revisor. Peso gzip registrado pelo autor não é waterfall nem prova de latência.

Parecer final: OK técnico para alterações específicas do painel em c16fadd, com melhoria de regressão permanente; produção continua bloqueada pelo auth preexistente e pelas dependências reais do MVP. Sem edição na worktree do autor, merge ou push.
