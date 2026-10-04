# VER-ROTAS — Dashboard T2

Worktree `/var/home/matheus/projetos/agenda-dashboard`, branch `feat/dashboard`, HEAD `c098a7a26a95b2f1a916c72dd288f546fcce07fd`. Servido em http://127.0.0.1:3343, infraestrutura sintética B-05 própria (PostgreSQL55443, SMTP25243). Código de produto não alterado; tarefas anteriores encerradas ou bloqueadas por dependência. Nenhum processo interrompido.

## Rota por rota — execução atual

| Caminho / método | Status e comportamento observado | Classificação / arquivo:linha |
| --- | --- | --- |
| `/dashboard/login` GET | HTTP200; formulário real envia link via SMTP sintético; verificação cria sessão normal. Sem mock ou bypass. | **OK** na configuração local de teste; `components/dashboard/login-form.tsx:32`, `lib/auth-client.ts:6`. Centralização B-02 ainda depende de T1, não foi implementada nesta auditoria. |
| `/dashboard/login?error=link` GET | HTTP200; alerta “Solicite um novo link de acesso”, com foco no aviso. | **OK**; `app/dashboard/login/page.tsx:7`, `components/dashboard/login-form.tsx:12`. |
| `/dashboard` GET, dia/semana | HTTP200 autenticado em375/1280, sem overflow; semana tem sete seções. `date=not-a-date` mostra alerta e fallback hoje. BusinessId inacessível mostra “Negócio indisponível”. Navegação após editar campo sem aplicar deixa data divergente, detalhe abaixo. | **MELHORAR**; `app/dashboard/(owner)/page.tsx:26`. |
| `/dashboard/customers` GET | HTTP200 autenticado em375/1280, sem overflow; lista real do banco. BusinessId inacessível não revela lista. | **OK**; `app/dashboard/(owner)/customers/page.tsx:7/10`, `lib/dashboard/data.ts:23`. URL/teclado/44px do WhatsApp têm prova integrada B-05 anterior, não repetida como gate nesta rodada. |
| `/dashboard/services` GET | HTTP200 autenticado em375/1280, sem overflow; serviços reais. BusinessId inacessível mostra estado indisponível e não oferece cadastro. | **OK**; `app/dashboard/(owner)/services/page.tsx:12`, `lib/dashboard/data.ts:19`. |
| `/dashboard/settings` GET | Página HTTP200 autenticada em375/1280; funcionamento real disponível. Região Pix mostra alerta de carregamento: GET da API local retorna404. | **BLOQUEIA** configuração Pix; `app/dashboard/(owner)/settings/page.tsx:11`, `components/dashboard/pix-key-form.tsx:26/30`. |
| `/dashboard/loginn` GET | HTTP404; rota não existe, grafia incorreta. | **OK** esperado; rota correta é `/dashboard/login` (`app/dashboard/login/page.tsx`). |

Todas as quatro rotas protegidas, sem sessão, responderam HTTP200 de transporte por streaming do Next, **mas browser terminou em `/dashboard/login`**, com formulário de login; não é acesso anônimo ao painel. `lib/dashboard/session.ts:9` e `(owner)/layout.tsx:4` aplicam a proteção. Status isolado não basta para avaliar autorização.

## Server Actions — execução sem persistência de negócio

| Caminho / método / ação | Observado | Classificação / arquivo:linha |
| --- | --- | --- |
| `/dashboard/services` POST `saveService` | Com sessão, sinal20/preço10: HTTP200 com erro de validação, sem sucesso; foco no alerta e nome preenchido preservado. Snapshot de serviços intacto. | **OK**; `actions.ts:15/26`, `lib/dashboard/validation.ts:12`, `components/dashboard/forms.tsx:10/32`. |
| `/dashboard/settings` POST `saveHours` | Com sessão, abertura18:00/fechamento09:00: HTTP200 com erro, sem sucesso; foco no alerta. Snapshot de horários intacto. | **OK**; `actions.ts:28/37`, `lib/dashboard/validation.ts:17`, `components/dashboard/forms.tsx:51`. |
| `/dashboard/services` POST `saveService`, sem sessão | Mesmo corpo inválido enviado por contexto anônimo: HTTP200 com `x-action-redirect: /dashboard/login;push`. Ação não persiste. | **OK**; `actions.ts:16`, `lib/dashboard/session.ts:9`. |
| `/dashboard/settings` POST `saveHours`, sem sessão | HTTP200 com `x-action-redirect: /dashboard/login;push`. Ação não persiste. | **OK**; `actions.ts:29`, `lib/dashboard/session.ts:9`. |

Paths de `actions.ts` na tabela referem-se a `app/dashboard/(owner)/actions.ts`. Não são REST200 de criação bem-sucedida: são respostas do protocolo Server Actions, com erro/redirect controlado. Nenhuma gravação válida foi executada nesta rodada de leitura.

## Problemas reproduzidos

1. **BLOQUEIA — Pix não carregável nesta instância.** `components/dashboard/pix-key-form.tsx:26/30`. Reproduzir: login de teste, abrir `/dashboard/settings?businessId=<fixture>`; GET `/api/businesses/<fixture>/pix-key` retorna404 e exibe “Não foi possível carregar a chave Pix”. Esperado: status mascarado configurado/não configurado da autoridade; observado: API ausente na branch do painel. Dono/dependência: T1 publica B-01/whitelist/CORS/cookie/fixture; T2 consome autoridade no passo2 B-02 aprovado. Não inventar API duplicada nem relaxar origem. PUT/DELETE não enviados nesta auditoria.
2. **MELHORAR — Campo de data fica diferente da agenda carregada.** `app/dashboard/(owner)/page.tsx:26`. Reproduzir: abrir agenda em2030-01-02; editar campo Data para2030-01-10 sem “Ver horários”; clicar “Próximo dia”. Observado URL/agenda2030-01-03, campo2030-01-10. Esperado: após navegação explícita, campo representa a data carregada. Impacto: dono pode interpretar período incorreto ou consultar a data errada. Dono T2; fronteira responsável é input não controlado com `defaultValue`, não backend. Nenhuma correção feita nesta tarefa somente leitura.

## Comandos, cobertura e limites

- `node /tmp/t2-ver-rotas.mjs`: passou após ajustar selector de alerta para o formulário/main (announcer nativo do Next também tem role alert; a ambiguidade inicial era da prova). Resultado privado/sanitizado em `/tmp/t2-ver-rotas-results.json`.
- Browser suplementar Chromium: GET anônimo das quatro rotas, HTTP200 e redirecionamento real para login confirmado; resultados em `/tmp/t2-ver-rotas-anonymous.json`.
- Foram verificados cinco caminhos válidos, uma grafia404, duas variantes de erro, quatro businessIds inacessíveis, quatro telas em duas larguras, semana, descompasso de data, duas ações inválidas autenticadas e duas sem sessão. GET Pix404 confirmado diretamente.
- Snapshot integral de serviços/horários/clientes/reservas antes e depois **idêntico**. Somente autenticação normal gerou sessão/verificação sintéticas e email local privado; nenhum dado de negócio, pagamento ou código de produto alterado. Tokens/cookies/MIME não publicados e traces desativados.
- Loading e fallback de erro de leitura inspecionados em `(owner)/loading.tsx:1/2` e `(owner)/error.tsx:3/4`. Prop `retry` corresponde à documentação do Next16.3.8 instalado. Falha de banco/SMTP e recuperação do error boundary não provocadas; sem parar infraestrutura para fabricar erro. Sucesso de gravação é prova histórica B-05, não execução nova.
- Lint/typecheck/unitários/build não repetidos, pois nenhum código funcional mudou. Não há nova validação do boundary de segurança de T1 nem de autoridade3000; prova de login é local3343 com origem restrita.

Próxima ação: Hermes/coordenador prioriza os dois achados; T2 só corrige após tarefa delimitada, e B-02 aguarda dependências. Sem merge/push/deploy.
