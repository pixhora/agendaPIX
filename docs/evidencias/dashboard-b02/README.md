# B-02 passo2 — Consumo implementado; prova autenticada bloqueada

## Código

Auth client aponta à autoridade localhost3000 (NEXT_PUBLIC_BACKEND_URL), credentials include. Login mantém UI existente e usa callbacks absolutos da origem do painel. Logout usa o mesmo cliente. Pix GET/PUT/DELETE aponta à autoridade com credenciais; input permanece fora do estado React/storage/log.

requireOwner consulta sessão pela autoridade, Cookie somente na origem configurada, no-store, redirect:error, timeout10s e validação Zod. Transporte/HTTP/schema inválidos retornam erro seguro, sem consultar dados com identidade presumida. Server Actions/tenant/centavos/lock preservados; APIs/libs locais não removidos.

## Provas atuais

- pnpm lint: exit0; pnpm typecheck: exit0; pnpm test:79/79, incluindo6 regressões da fronteira de sessão.
- pnpm exec playwright test --config tests/dashboard-login.config.ts:8/8,6,0s. Rota real localhost3343/dashboard/login,375/390/1280 claro/escuro,44px/teclado/overflow e screenshots anexas. Respostas do envio controladas provam loading/error/success, URL da autoridade e callbacks absolutos; não provam email entregue ou login real.
- HTTP backend3000 real, sem Cookie: get-session200; Pix GET401; OPTIONS Pix localhost3343/PUT/Content-Type204 com Allow-Origin específico e credentials:true; origem externa403 sem CORS. Nenhuma gravação/dado real/cobrança.
- Shell T2-B foi entregue separadamente em b7ad242;5 testes SSR e6 cenários browser isolados.

## Bloqueio material

/tmp/agenda-backend-b02-runtime.json e /tmp/agenda-backend-b02-fixture.json estão AUSENTES neste ambiente atual. Manifesto B05 anterior também ausente; processo3343 atual é PID29482 na worktree do painel. Nenhum processo foi parado ou banco reapontado. Solicitação única de caminhos0600 atuais enviada a BORA BILL, sem reenviar.

Pendente: conexão sintética comum validada, sessão renovada, browser autenticado e GET/PUT/DELETE Pix com persistência type/hint, isolamento e375/desktop. Não usar base desconhecida, seed/migrations ou Cookie falso para fingir integração. SMTP da autoridade não possui captor segundo o último contrato: entrega real de link ainda não provada nesta rodada. Build e revisão independente desta integração também pendentes; produção não aprovada.

Próximo responsável: BORA BILL/T1 fornece ambiente privado atual; T2 executa prova integrada após dependência. Reversão: revert do commit consumidor, mantendo APIs locais. Sessões/dados e mudanças documentais antigas preservados.
