# B-02 / T2 — Passo 2 bloqueado por dependências

Decisão autorizada: Next de agenda-backend em http://localhost:3000 será autoridade de auth e Pix. Base painel `feat/dashboard`, `b04643073fb1fd4ba557c67b35d09d1ce68ae714`. Nenhuma API/lib local removida; nenhum código funcional alterado.

## Evidência atual

- Backend HEAD `0d6858f`; `lib/auth.ts` e `app/api/auth/[...all]/route.ts` estão modificados e B-01 ainda sem commit. Não copiar WIP nem declarar aprovado.
- `agenda-backend/lib/auth.ts:30` contém trustedOrigins só da BETTER_AUTH_URL; não publica lista de UI3001/3005/3343. Origin check continua ligado (:31).
- `agenda-backend/app/api/businesses/[businessId]/pix-key/route.ts:14-21` permite mutações somente da origem BETTER_AUTH_URL. Adicionar origens ao Better Auth isoladamente não libera PUT/DELETE Pix do painel.
- Preflight real, sem sessão/dados/segredos: `curl -sS -D - -o /dev/null --max-time 10 -X OPTIONS -H 'Origin: http://localhost:3343' -H 'Access-Control-Request-Method: PUT' -H 'Access-Control-Request-Headers: content-type' http://localhost:3000/api/businesses/00000000-0000-4000-8000-000000000000/pix-key`. Observado204 e Allow DELETE/GET/HEAD/OPTIONS/PUT, **sem Access-Control-Allow-Origin/Credentials/Headers/Methods**. Browser não autoriza esse PUT cross-origin.
- Painel `lib/auth-client.ts:6` usa origem local implícita; `components/dashboard/pix-key-form.tsx:26/30/49/64` usa rota relativa e credentials same-origin. `lib/dashboard/session.ts:8` lê sessão com instância Better Auth local. Apenas trocar URL no input Pix não centraliza autenticação.

## Contrato necessário de T1

1. B-01 commitado e revalidado pelo handler real; entregar hash aprovado.
2. Publicar origens completas (scheme/host/port), URL autoridade e CORS com credenciais para auth/Pix. Preflight OPTIONS precisa aceitar Content-Type e PUT/DELETE; resposta deve permitir somente origem da whitelist, nunca wildcard com credenciais. Manter validação CSRF/origem nas mutações Pix e auth, negar origem externa. Nada de reescrever Origin para contornar checagem.
3. Definir host canônico único: browser painel http://localhost:3343 e backend http://localhost:3000. Cookie host-only em localhost compartilha portas; cookie localhost não acompanha127.0.0.1. Não alargar domínio nem desligar SameSite/origin check por tentativa. T1 confirma atributos/nome/path de cookie e callbacks absolutos de UI autorizados.
4. Disponibilizar fixture/ambiente backend sintético para sessão/tenant/Pix, com chave de criptografia somente no servidor. Dados do dashboard precisam corresponder ao mesmo ambiente sintético para autorização e leitura do negócio. Não usar dados reais nem publicar chaves/cookies.

## Implementação T2 após dependências prontas

- Configurar authClient para autoridade e requests com credenciais; callback e errorCallback retornam ao painel pelo host canônico, com verificação de origem mantida.
- Leitura de sessão em Server Components consulta autoridade, encaminhando cookie somente ao backend fixo, sem redirecionar credenciais a origem arbitrária. A cópia local não pode validar sozinha uma sessão da autoridade com segredo/DB diferentes.
- Pix chama autoridade, credentials include, segredo continua apenas no input não controlado e corpo transitório. Respostas só configured/type/hint; validar erros/loading/success após persistência real.
- Preservar app/api e libs locais até passo3 explicitamente autorizado. Não criar REST administrativo paralelo nem mudar Server Actions/tenant/centavos.

## Pronto e prova pendente

Login formulário SMTP local pela autoridade cria sessão e volta ao painel; Server Components reconhecem dono/tenant pela autoridade; GET/PUT/DELETE Pix persistem no backend e devolvem somente máscara/type/hint; origem maliciosa rejeitada. Browser localhost3343 em375/desktop. Gates após código novo; nenhum gate histórico apresentado como novo.

Esta rodada executou inspeção dos arquivos-alvo/dependências diretas e OPTIONS real; não iniciou alteração funcional nem teste de gravação. Infra B-05 própria3343 permanece ativa. Próxima ação: Codex/T1 entregar contrato/commit/fixture; T2 retoma somente depois. Sem mensagem nova ao Hermes, merge/push/deploy ou edição alheia.
