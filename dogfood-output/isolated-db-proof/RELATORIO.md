# QA independente — persistência, webhook e sessão

Data2026-10-04. Worktree agenda-tests, feat/tests, código testado ecc62d9. Banco novo e exclusivo PostgreSQL17-alpine: agenda_t3_isolated, porta127.0.0.1:34911; container agenda-t3-qa-bab398e8. Migrations versionadas aplicadas com sucesso. Credenciais aleatórias mantidas em arquivo privado0600 fora do repositório, não publicadas. Nenhum banco/servidor alheio alterado; container próprio parado após prova, dados preservados no container.

Comandos/resultados:
- Ambiente exclusivo carregado sem impressão de credenciais; `pnpm db:migrate`: exit0.
- `pnpm exec vitest run --config vitest.db.config.ts tests/integration/auth.test.ts tests/integration/pix.test.ts`:22/22 em2 arquivos, exit0.
- `pnpm exec playwright test tests/e2e/booking-pix.spec.ts --project=mobile --grep 'agenda, paga sinal fake|webhook repetido'`:2/2, exit0; servidor próprio3103 gerenciado/encerrado pelo Playwright.

OK — reserva persistida: tests/e2e/booking-pix.spec.ts:87 cria via POST real, consulta estado e verifica persistência PostgreSQL; teste:184 mantém uma reserva e uma cobrança após repetições. Sinal1000 centavos, provider fake; reserva pending_payment até webhook autenticado. Integração também cobre idempotência da criação, concorrência, isolamento por negócio, valor incorreto e pagamento tardio.

OK — webhook idempotente: tests/e2e/booking-pix.spec.ts:184. Primeiro evento processed; mesmo evento repetido e novo evento do mesmo pagamento duplicate. Resposta HTTP200, pagamento/reserva confirmed/paid, registro financeiro inalterado, uma reserva/uma cobrança. Entregas auditadas processed/duplicate/duplicate. Não existe segunda confirmação financeira.

OK — sessão expirada: tests/integration/auth.test.ts:34-74. Handler Better Auth real com DB exclusivo e envio de email mock cria sessão, valida cookie, força expiresAt passado no PostgreSQL e get-session retorna null. Link expira/reuso sequencial/concorrente e origem/callback inválidos também passam. Nenhum email real enviado.

Limites: Pix simulado via FakePaymentProvider e webhook autenticado fake; não comprova recebimento bancário. Os2 Playwright usam APIRequestContext/HTTP e PostgreSQL, não jornada visual375px/desktop. Prova visual Preview anterior é separada. Esta execução testa código T3ecc62d9, não atesta integração dos HEADs atuais T1/T2/T4. Fixtures sintéticas limpas pelos testes; prova de persistência ocorreu antes da limpeza. Nenhuma falha demonstrada nos três critérios solicitados.
