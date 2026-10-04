# Login do dashboard — identidade e provas

## Escopo e resultado

T2, `feat/dashboard`, rota real `http://127.0.0.1:3343/dashboard/login`.

Apresentação alinhada à identidade disponível de T4/T5: marca Agenda com símbolo A, fundo claro editorial/escuro verde, card central, CTA lime em pill, Plus Jakarta Sans nos títulos e Inter no texto. Fontes auto-hospedadas por `next/font`, restritas à página de login. Input e CTA têm 48px; link da marca tem 44px. Sem alteração de `app/globals.css`, componentes UI compartilhados ou backend.

Paleta aprovada de T4 (`7bed0cd`) e referência lida de T5 em `agenda-conversion/app/login/page.tsx` e `app/globals.css`. O CSS Module limita os valores existentes da identidade ao login enquanto a integração dos tokens compartilhados não está nesta branch; reaproveita as variáveis de accent/surface quando disponíveis. Não há nova dependência.

`authClient.signIn.magicLink`, `callbackURL: "/dashboard"` e `errorCallbackURL: "/dashboard/login?error=link"` preservados. Loading anuncia espera e impede novo envio; erro recebe foco e oferece nova tentativa; sucesso aparece somente após resposta aceita pelo cliente de autenticação.

## Comandos e resultados

- `pnpm exec playwright test --config tests/e2e/dashboard-login.config.ts`: 8/8 passaram, 4,5s, Chromium no servidor já ativo 3343, sem iniciar/parar servidor.
- `pnpm lint`: passou, zero warnings.
- `pnpm typecheck`: passou.
- `pnpm test`: 73/73 passaram, 7 arquivos.
- Node 22.23.3. Browser confirmou fontes Plus Jakarta Sans/Inter carregadas.

Seis provas de layout em 375/390/1280 × claro/escuro: marca visível, alvos ≥44px, sem overflow horizontal e teclado alcança o input. Capturas `login-{largura}-{tema}.png` vêm da rota real, com formulário inicial e sem interceptação HTTP de autenticação.

Os testes de espera/sucesso/falha interceptam somente a resposta HTTP para verificar a UI e os callbacks; não são prova SMTP nem sessão real. Teste separado verifica o estado real de link indisponível em `?error=link`. Nenhum sucesso simulado foi implementado no produto.

## Bloqueadores e coordenação

Envio real continua respondendo `403 INVALID_ORIGIN`: servidor 3343 configurado com `BETTER_AUTH_URL` 3342. Nova prova real mostra alerta focado e ausência de overflow; `login-error-real-375-light.png` mascara o input para não publicar o email da fixture. Operador QA/T1 deve alinhar a origem na inicialização coordenada; não foi relaxada a proteção nem interrompida a sessão.

Trilha não consta em `maestri list`. Tentativa de alinhamento ao coordenador retornou `maestri: Multiple terminals named 'Codex' found (2). Rename them to have unique names.`; `maestri debug` confirmou transporte saudável. Nenhum terminal foi renomeado/reiniciado. A referência disponível foi reutilizada; revisão direta de Trilha permanece pendente.

Próximo responsável: CODEFICADO/Trilha revisam as capturas e T1/operador corrige a configuração de QA. A apresentação tem prova atual; acesso autenticado continua dependente desse alinhamento.
