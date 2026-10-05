# Revisão técnica: autenticação, tenant, reservas e webhook

Data: 2026-10-03. Responsável pela revisão: Codex Revisor.
Backend revisado: f54803f994093d51bce7a51ae4afb82c251a5406.
Painel revisado: db341e6 (HEAD observado).

## Escopo e método

Leitura das duas worktrees, sem alterações nelas. Execução focada em uma cópia do commit backend em `/tmp/agenda-review-f54803f`, com dependências instaladas já existentes. Não foram repetidos lint, typecheck, suíte geral, integrações PostgreSQL ou QA de booking/Preview/mobile. A alteração preexistente de AGENTS.md na worktree de revisão foi preservada; esta revisão não a modificou. Sem merge ou push.

## Bloqueia — erro bruto ainda chega ao console na autenticação

Local responsável: `agenda-backend/lib/auth.ts:16`; entrada HTTP: `app/api/auth/[...all]/route.ts:10`. Causa confirmada na dependência instalada: `better-call/dist/router.mjs:93` (better-call 1.4.0).

O logger personalizado descarta corretamente detalhes recebidos. Porém, quando `sendMagicLinkEmail` rejeita com um Error comum, o handler do Better Auth retorna ao catch do better-call. Esse catch executa `console.error("# SERVER_ERROR: ", error)` independentemente do logger personalizado. Portanto, mensagens e stack do erro SMTP ou do banco podem continuar publicando dados sensíveis nos logs. A resposta HTTP observada é 500 e não contém o marcador sintético; o vazamento confirmado ocorre no console.

Reprodução: usar getAuth real; substituir apenas a persistência de verificação por um stub sem banco; fazer o envio de email rejeitar com Error contendo um marcador sintético; enviar POST ao handler real de magic link; inspecionar argumentos de console.error incluindo Error.stack. O teste abaixo falha em f54803f. Trecho decisivo observado: `[Agenda auth] Authentication operation failed # SERVER_ERROR: Error: REVIEW_SYNTHETIC_PRIVATE_MARKER`.

Responsável: Codex, backend. Corrigir o tratamento no limite real de erros do Better Auth/handler, preservando resposta segura e comportamento de autenticação. Somente substituir o logger não resolve o catch da dependência. Não interceptar globalmente console.error.

Relacionado: `agenda-dashboard/lib/auth.ts:11` ainda não contém sequer o logger seguro. A mesma reprodução, substituindo apenas lib/auth.ts pela versão do painel, confirmou publicação do Error. Responsáveis: Codex pela correção compartilhada; CODEXADO pela integração no painel antes de aprovação dessa versão.

## Melhorar — regressão testa callback, não erro no handler

Local: `agenda-backend/tests/unit/auth-logger.test.ts:13`.

O teste chama `getAuth().options.logger.log` diretamente. Ele confirma a configuração real, mas não atravessa o catch que publica o Error bruto. Resultado final: teste existente passa; reprodução do handler falha. Responsável: Codex. Incorporar regressão de falha SMTP/banco através de auth.handler e inspecionar também propriedades não enumeráveis de Error; JSON.stringify sozinho reduz Error a `{}` e não detecta a mensagem/stack.

## OK na leitura — tenant

Backend: `lib/bookings/service.ts:40` restringe serviço por businessId; `:124` restringe reserva por negócio e exige token em comparação constante. `db/schema/index.ts` inclui chaves estrangeiras compostas por tenant.

Painel: `lib/dashboard/session.ts:7` obtém dono da sessão; `lib/dashboard/data.ts:14` autoriza negócio por dono, `:38` restringe joins por tenant e `:48` restringe alteração de serviço por businessId e id. Server Actions obtêm o dono no servidor, sem REST duplicado. Cobertura existente: `tests/integration/dashboard.test.ts:28`, `:39`; backend `tests/integration/database.test.ts:63`, `:75` e `tests/integration/pix.test.ts:62`, `:173`.

Não foi encontrada falha de isolamento neste recorte. Integrações foram lidas, não executadas novamente. Responsáveis: Codex e CODEXADO.

## OK na leitura — reservas concorrentes

Backend: `lib/bookings/service.ts:28` usa pg_advisory_xact_lock por negócio, adquirido dentro da transação de criação antes da consulta/inserção. `db/migrations/0002_prevent_overlapping_bookings.sql:3` impõe exclusão de intervalos sobrepostos no banco. Cobertura existente: `tests/integration/pix.test.ts:78` disputa o mesmo horário; `:87` verifica escrita direta sem a aplicação.

Não foi encontrada falha verificável de dupla reserva neste recorte. Sem repetir integração aprovada. Responsável: Codex.

## OK na leitura — webhook fake

Backend: `lib/payments/fake.ts:24` valida timestamp, tolerância de 300 segundos, assinatura HMAC sobre timestamp e corpo e compara em tempo constante. `lib/payments/webhook.ts:24` autentica antes de aplicar o evento; `:28` deduplica por provider/eventId; `:32` rejeita conteúdo divergente; `:38` serializa por negócio; `:40` atualiza relógio após espera pelo lock; `:49` registra resultado na mesma transação. Entregas rejeitadas/falhas são registradas com metadados sem corpo bruto.

Cobertura existente: `tests/integration/pix.test.ts:115` rollback e nova tentativa; `:133` entregas simultâneas; `:144` assinatura inválida; `:157` evento divergente; `:163` pagamento tardio. Não foi encontrada falha verificável nesses mecanismos. Responsável: Codex.

Limite: só existe provider fake neste commit, bloqueado em produção por `lib/payments/index.ts:7`. Esta revisão não aprova autenticidade de Asaas/Mercado Pago nem cobrança real.

## Reprodução persistida

Em uma cópia isolada do backend f54803f, salvar o trecho abaixo como `tests/unit/reviewer-auth-error.test.ts`. Executar `node node_modules/vitest/vitest.mjs run tests/unit/auth-logger.test.ts tests/unit/reviewer-auth-error.test.ts`. Resultado esperado antes da correção: 1 teste passa e 1 falha. Nenhum email real é enviado; nenhum banco é acessado.

```ts
import { expect, it, vi } from "vitest";
import { getAuth } from "../../lib/auth";
import { sendMagicLinkEmail } from "../../lib/email";
vi.mock("../../lib/email", () => ({ sendMagicLinkEmail: vi.fn() }));
it("backend handler hides SMTP failure details", async () => {
 vi.stubEnv("DATABASE_URL", "postgresql://local:example@localhost/agenda");
 vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
 vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
 const auth = getAuth();
 const context = await auth.$context;
 vi.spyOn(context.internalAdapter, "createVerificationValue").mockResolvedValue({} as never);
 vi.mocked(sendMagicLinkEmail).mockRejectedValue(new Error("REVIEW_SYNTHETIC_PRIVATE_MARKER"));
 const error = vi.spyOn(console, "error").mockImplementation(() => {});
 const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
 const response = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/magic-link", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ email: "synthetic@example.com" }) }));
 expect(response.status).toBe(500);
 expect(await response.text()).not.toContain("REVIEW_SYNTHETIC_PRIVATE_MARKER");
 expect([...error.mock.calls,...warn.mock.calls].flat().map((value) => value instanceof Error ? value.stack : String(value)).join(" ")).not.toContain("REVIEW_SYNTHETIC_PRIVATE_MARKER");
 vi.restoreAllMocks(); vi.unstubAllEnvs();
});
```

## Resultado

f54803f não recebe OK: há um bloqueio reproduzido de publicação de erro bruto. As proteções de tenant, concorrência e webhook fake não apresentaram novos bloqueios na leitura. Aprovação completa permanece pendente da correção e da regressão focada passando.
