# VERIFICAÇÃO DE ROTAS — T1 / VER-ROTAS

Data: 2026-10-04, aproximadamente 11:55 BRT. Branch: `feat/backend`. Commit: `cafc5b2dc820aa11ef6a5e3008019f50339964a5`.
Base HTTP exercitada: `http://localhost:3000`. Escopo: oito arquivos `app/api/**/route.ts` e suas dependências diretas.

## Resultado

**BLOQUEIA a integração B02 entre portas e o lançamento com Pix real.** Os controles negativos exercitados funcionaram. Não foi encontrada nova evidência de exposição de dados nas respostas amostradas. Isso não certifica todas as sessões, tenants ou fluxos financeiros.

Nenhum código, configuração ou dado de negócio foi alterado nesta verificação. Este relatório é a única entrega documental desta tarefa. Não houve commit, merge, push ou deploy. Requisições HTTP podem gerar logs internos do servidor.

## Método e limites

Executadas 14 requisições GET/OPTIONS sem sessão, incluindo serviços e disponibilidade da fixture já existente `barbearia-demo`. Os identificadores utilizados nas consultas de pagamento/Pix são inexistentes; nenhum token real foi consumido. Não foram disparados e-mails, reservas, cobranças, webhooks, PUT/DELETE de chave Pix, migrations ou seed. O GET de pagamento existente pode expirar registros: por isso não foi usado com reserva real autorizada.

`pnpm test` executado nesta passagem: **60/60 testes, oito arquivos, aprovados**. `vitest.config.ts` limita essa execução aos unitários; não confundir com integração PostgreSQL ou E2E. Não repetidos lint/typecheck/build, pois não houve alteração de código. Resultados de auditorias anteriores não são apresentados como novas execuções.

## Rota a rota

| Caminho | Método | Comportamento observado nesta passagem | Problema / referência | Classificação |
|---|---|---|---|---|
| `/api/health` | GET | HTTP200, JSON `status: ok`. | `app/api/health/route.ts:1`: prova processo HTTP, não banco/SMTP/gateway. Não há checagem dessas dependências. | melhorar: não usar isoladamente como prontidão financeira |
| `/api/auth/[...all]` → `/get-session` | GET | HTTP200, corpo `null`, `Cache-Control: no-store`, sem sessão. | `app/api/auth/[...all]/route.ts:6` / `lib/auth.ts:31`: handler protegido; confiança limitada à origem3000. Nenhum problema na consulta sem sessão. | ok no recorte; bloqueia integração B02 |
| `/api/auth/[...all]` → `/sign-in/magic-link`, `/sign-out` | POST | Não executado, pois pode enviar e-mail/gravar verificação/encerrar sessão. Inspeção: handler passa por `handleHttp`; hook saneia5xx. Unitários do handler aprovados na suíte. | `app/api/auth/[...all]/route.ts:10`, `lib/auth.ts:31`: origens3001/3005/3343 não estão na whitelist aprovada de B02. | bloqueia integração B02; envio real não revalidado nesta tarefa |
| `/api/auth/sign-in/magic-link` | OPTIONS | Origin3343, método solicitadoPOST e headercontent-type: HTTP204, Allow GET/HEAD/OPTIONS/POST; **sem** Access-Control-Allow-Origin/Credentials. | `app/api/auth/[...all]/route.ts:6`: nenhum handler OPTIONS/CORS explícito; resposta automática do Next não libera fetch com credenciais entre portas. | bloqueia B02 |
| `/api/public/[slug]/services` | GET | Demo200 com três serviços; negócio inexistente404 `business_not_found`; slug inválido400 `invalid_input`; respostas no-store. | `app/api/public/[slug]/services/route.ts:4`, `lib/bookings/service.ts:45`: consulta expõe somente catálogo público ativo. Nenhum problema reproduzido. | ok no recorte |
| `/api/public/[slug]/availability` | GET | Sem query400 `invalid_input`. Serviço demo `c189f040-17dd-4606-b8c4-08474eb2cdb1`, data2026-10-05: HTTP200 com18 horários, no-store. | `app/api/public/[slug]/availability/route.ts:4`, `lib/bookings/service.ts:60`: valida query e procura serviço pelo tenant do slug. Nenhum problema reproduzido. | ok no recorte |
| `/api/public/[slug]/bookings` | POST | Não executado, pois cria reserva/cliente/cobrança. Inspeção: valida corpo/chave, locks, preço do servidor, replay e limite16KiB. GET sem suporte retornou405. | `app/api/public/[slug]/bookings/route.ts:4`, `lib/bookings/service.ts:104`, `lib/payments/index.ts:6`: provider só fake; não produz Pix pagável e produção responde indisponibilidade. | bloqueia lançamento com Pix real; criação/replay não revalidados via HTTP nesta passagem |
| `/api/public/[slug]/bookings/[id]/payment` | GET | ID inválido400; ID inexistente sem Bearer404 `booking_not_found`; no-store. Não consultada reserva autorizada. | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4`, `lib/bookings/service.ts:118`: consulta exige token e tenant; após autorização expira pendências (`:130`). `lib/payments/fake.ts:20`: copia-e-cola explicitamente não pagável. | ok no controle negativo; bloqueia Pix real |
| `/api/webhooks/payments/[provider]` | POST | Não executado, mesmo com assinatura inválida: grava delivery antes da autenticação (`lib/payments/webhook.ts:17`). GET retornou405. Inspeção: assinatura/token temporal do fake, hash, eventos e idempotência transacional. | `app/api/webhooks/payments/[provider]/route.ts:4`, `lib/payments/index.ts:6`: nenhum gateway real disponível. A assinatura fake não homologa assinatura Asaas/Mercado Pago. | bloqueia lançamento com confirmação bancária; webhook/idempotência não revalidados no banco nesta passagem |
| `/api/businesses/[businessId]/pix-key` | GET | Sem sessão401 `unauthorized`, no-store. Leitura autenticada não exercitada. | `app/api/businesses/[businessId]/pix-key/route.ts:8`, `lib/pix-key/service.ts:10`: dono vem da sessão; resposta prevista só configured/type/hint. Nenhum vazamento no401. | ok no recorte |
| `/api/businesses/[businessId]/pix-key` | PUT | Não executado, pois modifica chave. Inspeção exige sessão/origem, valida chave, cifra AES-GCM e devolve máscara; env privado tem chave de cifragem presente, validade não testada aqui. | `app/api/businesses/[businessId]/pix-key/route.ts:14`: aceita somente origem3000, não3343 aprovada no B02. Chave armazenada não é passada ao provider de reserva (`lib/bookings/service.ts:108`). | bloqueia B02 e promessa de recebimento na chave do dono |
| `/api/businesses/[businessId]/pix-key` | DELETE | Não executado, pois exclui chave. Mesmos controles de sessão/origem do PUT. | `app/api/businesses/[businessId]/pix-key/route.ts:38` / `:14`: origem3343 ainda recusada pela inspeção. | bloqueia B02; exclusão autenticada não revalidada |
| `/api/businesses/[businessId]/pix-key` | OPTIONS | Origin3343, método solicitadoPUT e headercontent-type: HTTP204, Allow DELETE/GET/HEAD/OPTIONS/PUT; **sem** Allow-Origin/Credentials. | `app/api/businesses/[businessId]/pix-key/route.ts:25`: nenhum OPTIONS/CORS explícito. Allow não substitui Access-Control-Allow-Methods/Headers. | bloqueia B02 |

Os status400/401/404/405 acima são comportamentos corretos de rejeição, não bugs por si mesmos. Ausência de CORS é bloqueio do desenho B02 entre origens aprovado, não vulnerabilidade nem erro em uso na mesma origem.

## Achados encaminhados

1. **BLOQUEIA — T1/B02:** whitelist auth e origem Pix não incluem3001/3005/3343; preflights não têm CORS com credenciais. Provas GET/OPTIONS e referências acima. Nenhuma proteção foi desligada para contornar isso. Correção e contratos pertencem à tarefa T1-B02-1 separada; conciliar com recomendação Cursor de app único antes de integrar consumidores.
2. **BLOQUEIA — T1/pagamento + decisão do produto:** só existe fake, rejeitado em produção. Cadastro seguro da chave Pix já existe, mas não conecta a cobrança ao beneficiário. Definir caminho real de recebimento/confirmação e implementar/homologar gateway; não chamar QR fake de pagamento real.
3. **MELHORAR — infraestrutura:** health é liveness apenas. Na validação de deploy, exigir provas separadas de banco, auth/env, SMTP e gateway. Não inferir disponibilidade comercial por HTTP200 de health.

## Contexto preservado

Incidente anterior de e-mail da landing: configuração ausente BETTER_AUTH_SECRET corrigida por T5; configuração Resend existente autenticou e a mensagem solicitada foi confirmada delivered no provedor. Esta tarefa não enviou outro e-mail nem validou outra sessão. B01 `02c5b27` já revisado OK. Backend analisado inclui esse commit. Outras worktrees podem continuar com cópias antigas; o relatório cobre somente agenda-backend.

## Próxima prova quando liberada escrita

T1 concluir contrato/origens/CORS da composição escolhida; T2/T4/T5 integrar consumidores. Depois T3 exercitar sessão/tenant real sintético, PUT/DELETE Pix, criação/replay/concorrência de reserva e webhook duplicado em banco isolado. Homologação financeira real exige gateway/beneficiário configurados e pagamento real controlado; não foi executada aqui.

## Revalidação posterior — B02 e fundamentos implementados

O relatório acima preserva a auditoria somente leitura em cafc5b2. Em tarefa posterior autorizada pelo Hermes:29f3b75/1332daa corrigiram whitelist/CORS e fixture operacional; revisão B02 OK. Provas HTTP de sessão,preflights,GET/PUT/DELETE Pix e origem externa confirmadas com dados sintéticos. c407968 adicionou contador atômico PostgreSQL e/api/ready;82unit/27DB/build/lint/typecheck aprovados. Ready200 verificado com DB/SMTP configurados, sem envio de e-mail;11 chamadas com data passada produziram10x409+429/Retry60,sem criar reserva/cobrança. Endpoint onboarding segue ausente (contrato F01 definido). Pix bancário segue bloqueador independente. A tabela inicial não descreve o estado posterior dessas correções.
