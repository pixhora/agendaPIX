# T3-V1 — regressão independente READ-ONLY

T3/CODEFICADO, worktree agenda-tests, branch feat/tests, HEAD ecc62d9. Sem produto alterado, checkout/rebase, email, escrita em banco ou reinício de serviços. B-06 segue em fila até B-05. Entrega via fila do Codex, sem novo ask ao Hermes.

## Gates atuais

Booking-ui HEAD 5b4c3ad, árvore limpa; contém4545a9f(T-02),8c0237d(T-04) e delta adicional timeout F-04. `pnpm lint`, `pnpm typecheck`, `pnpm test`: exit0;62/62 em8 arquivos. Dashboard HEAD b046430, contém f4b4361(T-03) e delta adicional de testes; docs/artefatos alheios já sujos foram preservados. Mesmos três comandos: exit0;73/73 em7 arquivos. Não são gates em checkouts exatos de cada commit isolado; validam HEADs que os contêm. Nenhuma alteração de status causada pelos checks observada.

Dashboard adicional: `pnpm exec vitest run --config tests/dashboard-ui.config.ts` na worktree dashboard:1/1 passou. Valida render SSR real com dados/sessão/Shell mockados, URL WhatsApp/telefone, mensagem codificada e chamada do leitor com negócio/dono. Não prova isolamento DB.

## Classificação por delta e definição de pronto

### T-02 — 4545a9f — PARCIAL / OK observado

Arquivo `components/onboarding/StepBusiness.tsx:73,83`: alteração shrink-0/min-w-0, sem dinheiro/tenant modificado. Browser independente em http://127.0.0.1:3001/onboarding,375/1280: slug comprido preservado, campo44px, documento sem overflow. Capturas onboarding-375.png/onboarding-1280.png, resultados results.json nesta pasta; comando `node dogfood-output/t3-v1/onboarding.mjs`, exit0.

Limite:3001 serve bundle antigo identificado no T-04 abaixo; não afirmar que captura comprova build4545a9f. Pronto ainda exige URL associada ao commit e confirmação do delta nos estados reais. Estados completos/onboarding integrado não foram reexecutados; fora desta correção de largura.

### T-03 — f4b4361 — PARCIAL / OK mock

Arquivo `app/dashboard/(owner)/customers/page.tsx:10`: teste específico1/1 valida WhatsApp E.164 sem55 duplicado, escape da mensagem, noopener/noreferrer e Ligar preservado. Gates73/73 verdes; query/tenant não alterados pelo delta. Browser autenticado não executado: `node dogfood-output/t3-v1/customers.mjs` falhou ENOENT de /tmp/agenda-t2-final/fixture.json antes de abrir navegador. Não recriar dados/session sem autorização de ambiente. Provas do autor375/1280 são históricas/mock; não tratadas como prova independente atual.

MELHORAR / pendência T2/operador: disponibilizar fixture e storageState sintéticos atuais, URL/commit servido; T3 revalida375/1280,44px, foco/Tab, sem overflow, contexto de negócio autorizado. Nenhuma navegação ao WhatsApp real executada.

### T-04 — 8c0237d — BLOQUEIA aprovação / prova atual indisponível

`components/booking/BookingFlow.tsx:180-191,370`: retomada usa startsAt/endsAt da consulta e sucesso exige selectedSlot. Contrato T3 `docs/CONTRATOS.md:104` descreve consulta payment sem startsAt/endsAt; sessão persistida não guarda horário. Assim, resposta confirmed no contrato descrito não preenche selectedSlot e não satisfaz condição de render da confirmação. É risco concreto de compatibilidade do delta, não vulnerabilidade/pagamento bancário confirmado. Donos T4/T1: verificar contrato efetivo mais recente; restaurar informação de horário por mecanismo autorizado sem inventar campos nem expor PII. Critério: reload com status confirmed real renderiza confirmação com horário correto, sem POST novo.

Reprodução independente preparada com resposta payment nos campos do contrato, sessionStorage sintético e services mock. `node dogfood-output/t3-v1/proof.mjs`: teste aguardou resposta payment e expirou em30s; nenhuma retomada chamada. Diagnóstico focal `debug.mjs`: pending e confirmed permaneceram na escolha de serviço; bundle servido3001 não contém booking_session_. Verificação HTTP das9 tags script confirmou resumeMarker:false. Portanto3001 não disponibiliza T-04; NÃO atribuir esse comportamento ao commit novo. Sem build alterado ou servidor reiniciado. Capturas restore-pending_payment.png/restore-confirmed.png são do build antigo, não reprovação funcional do código novo.

MELHORAR / risco de estado T4: `BookingFlow.tsx:214-218` apaga sessão persistida em qualquer falha da consulta, incluindo falha transitória503/rede; isso impede recuperação posterior sem criar nova jornada. Revalidar falha recuperável quando build correto estiver disponível. Não afirmar reprodução nesse build antigo.

Pronto bloqueado por URL/build identificado contendo T-04, contrato efetivo e ambiente sintético. Cobrir pending até status confirmed do servidor, reload confirmado/expired/cancelled, falha503 recuperável, nenhuma nova reserva/duplicidade, centavos/tenant/token corretos; estes testes permanecem pendentes. Sinal fake/QR não comprova recebimento. Não houve teste bancário ou alteração de contrato.

## Transparência

Uma tentativa do comando dashboard-ui na worktree T3 usou configuração inexistente e falhou startup; corrigido apenas diretório do comando, execução dashboard1/1 passou. Não classificado como falha de produto. Browser fixture faltante e bundle antigo são bloqueios de prova, não gates inventados.

Artefatos próprios não versionados em dogfood-output/t3-v1; nenhum segredo incluído. Nenhum gate geral de build solicitado/executado; lint/typecheck/test reais reportados acima. Revisão read-only encerrada; próxima ação é handoff do Codex aos donos das dependências, não B-06 antecipado.
