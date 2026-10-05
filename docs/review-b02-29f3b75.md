# Revisão B02 passo 1 — 29f3b75

Candidato: 29f3b75a766614af3f445c3f1f9b1e26e17af91f, feat/backend. Somente delta commitado de origins/auth/wrappers/fixture e testes diretos; WIP de antiabuso/readiness excluído. Fixture privada existente não foi aberta. Sem banco/SMTP, mudanças no produto ou gates gerais.

## OK

lib/origins.ts:12 compara Origin completo com allowlist exata; não deriva confiança de Host/Forwarded. Spoofs localhost:3343.evil.example, null, 127.0.0.1 e sufixo /path rejeitados antes do handler. :8 exclui portas locais em produção. :20 preserva status, corpo e múltiplos Set-Cookie; CORS credenciado apenas para origem específica, Vary/no-store. :38 valida métodos/headers no preflight. Pix PUT/DELETE ainda exigem Origin, sessão e tenant; CORS não autoriza usuário.

lib/auth.ts:32 configura crossSubDomainCookies.enabled=false e verificação de origem ativa. Trusted origins vem da mesma allowlist; callbacks de portas locais aprovadas passam no handler real. Erros seguros da correção anterior continuam passando nos testes. Host-only não isola portas do mesmo host; isso é compatível com a autoridade localhost definida neste contrato de desenvolvimento.

scripts/create_backend_fixture.mjs:11/:17 bloqueia execução fora de NODE_ENV=development, banco remoto e autoridade diferente. CLI não cria rota pública de bypass. :21 abre arquivo exclusivo 0600; identificadores/email são sintéticos, token aleatório, sessão expira em uma hora; segredo não é copiado ao frontend nem impresso no stdout. Guardar somente arquivo privado, não versionar. Restrição a banco local não prova que banco seja descartável; execução exige escolher banco autorizado.

## MELHORAR

scripts/create_backend_fixture.mjs:42/:43 efetua COMMIT antes de gravar artefato. Reprodução por inspeção: se writeFileSync falhar após COMMIT (erro de I/O), finally tenta ROLLBACK, mas registros já persistiram, e remove arquivo. Impacto: registros/sessão sintéticos órfãos, sem fixture para recuperação. Não é bypass remoto nem vazamento confirmado; não foi induzida falha em banco real. Dono T1. Critério: falha pós-commit recuperável com cleanup compensatório seguro ou artefato recuperável; garantir release/close mesmo se cleanup falhar.

## Prova independente

Snapshot git archive do candidato: /tmp/agenda-review-b02-29f3b75, sem .env e sem acesso à fixture privada.

`node <backend>/node_modules/vitest/vitest.mjs run --root /tmp/agenda-review-b02-29f3b75 tests/unit/origins.test.ts tests/unit/auth-handler.test.ts`

Exit 0, 25/25 testes, dois arquivos. Casos: origens exatas, spoof externo, produção sem origens dev, preflight inválido, cookies múltiplos e erro/status conservados, auth/SMTP/adapter/APIError saneados, callbacks locais e configuração inválida segura. Provas HTTP de oito casos informadas pelo autor não foram repetidas nem atribuídas ao revisor. Não testado nesta rodada: fixture com DB, emissão real de sessão, produção HTTPS real ou conexão frontend.

Parecer: OK para o delta CORS/auth B02, com melhoria operacional não bloqueadora na fixture. Não equivale a homologação de produção/Pix real. Nenhum achado novo bloqueador de spoof/CSRF/CORS no recorte.
