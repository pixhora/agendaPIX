# Diagnóstico do login no servidor 3343

## Escopo

T2, `feat/dashboard`, produto em `ebcf5c4` (inclui `96ac512`). Nenhum código de produto alterado. Servidor e sessões preservados.

## Bloqueia — origem do servidor de QA divergente

- Responsável: operador da infraestrutura de QA/coordenador T1.
- `lib/auth.ts:14` usa `BETTER_AUTH_URL` como URL base; `lib/auth.ts:16` permite somente sua origem. O processo 627597, porta 3343, está configurado com `BETTER_AUTH_URL=http://127.0.0.1:3342`.
- Reprodução real: abrir `http://127.0.0.1:3343/dashboard/login`, preencher email da fixture sintética e clicar em “Receber link de acesso”.
- Observado: POST `/api/auth/sign-in/magic-link` responde `403`, código `INVALID_ORIGIN`. `components/dashboard/login-form.tsx:13` apresenta “Não foi possível enviar o link. Confira seu email e tente novamente.”; nenhum status de sucesso aparece.
- Esperado: com origem e URL configuradas alinhadas, envio aceito e status “Confira sua caixa de entrada”. Não liberar origem arbitrária para contornar a configuração.

## Provas executadas

- Inspeção somente dos campos não secretos do ambiente do processo: URL Better Auth 3342; SMTP `127.0.0.1:25242`; PostgreSQL sintético `127.0.0.1:55442`. Serviços estão ouvindo.
- HTTP com origem real 3343: `403 INVALID_ORIGIN`.
- Playwright/Chromium em 375x812: envio pelo formulário reproduziu 403, alerta visível e zero status de sucesso. A primeira tentativa de inspeção do alerta teve seletor ambíguo com o anunciador do Next; a repetição restringiu o seletor ao formulário e passou.
- Diagnóstico HTTP separado, com origem configurada 3342: resposta 200. Esse teste não criou sessão nem consumiu link. O envio SMTP é aguardado pelo servidor; não foi observado bloqueio SMTP. Contagem de arquivos `.eml` não aumentou, portanto não se alega prova de novo arquivo entregue.
- Não repetidos gates gerais ou CRUD autenticado; nenhuma mudança de produto nesta rodada. Nenhum token, email da fixture, credencial ou link mágico foi publicado.

## Próxima ação

Operador deve alinhar `BETTER_AUTH_URL` à URL canônica usada pelo browser e QA, incluindo host (`127.0.0.1` ou `localhost`) e porta. Aplicar na próxima inicialização autorizada do servidor, preservando o processo ativo até essa coordenação. Depois, CODEFICADO deve repetir o login SMTP e o fluxo autenticado. Não há correção frontend comprovada nesta falha.
