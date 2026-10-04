# Agenda — sincronização do campo Data

Base `feat/dashboard` / `c098a7a`. Falha previamente reproduzida em VER-ROTAS: Data editada2030-01-10 sem aplicar; Próximo dia carrega URL2030-01-03 e mantém campo2030-01-10.

Correção restrita a `app/dashboard/(owner)/page.tsx:26`: chave do input usa a data efetivamente carregada. Ao mudar o dia, só o controle nativo é recriado com o default correto; agenda, formulário e demais controles não recebem chave nova. Edição permanece livre até aplicar GET ou navegar. Nenhum backend/contrato/shared/tokens alterado.

## Prova executada

- `pnpm lint`: passou, zero warnings.
- `pnpm typecheck`: passou.
- `pnpm test`:73/73, sete arquivos,1,68s.
- `pnpm exec eslint tests/dashboard-ui/agenda-date-browser.mjs --max-warnings=0`: passou.
- `QA_DASHBOARD_FIXTURES=/tmp/agenda-t2-b05-UyyG6a node tests/dashboard-ui/agenda-date-browser.mjs`: passou em375/1280. Sessão normal por SMTP sintético, sem bypass/mock. Editar2030-01-10 e Próximo dia agora produz URL/campo2030-01-03; anterior retorna02; Ver horários aplica10; Semana preserva10; Próxima semana sincroniza17. Zero overflow. Capturas/resultados nesta pasta.
- `git diff --check`: passou. Sem build novo: correção de uma propriedade do input, gates e browser direcionado executados.

## Outras solicitações de Hermes

Login: componente atual já possui marca, fontes Inter/Plus Jakarta e CTA lime, entregue em9e24951; descrição “form cru” é anterior a essa alteração. Contrato oficial de Trilha/F-02 solicitado uma vez via BORA BILL/coordenador, conforme topologia. Não criar cópia da UI nem redirecionar entre hosts sem rota/callback/cookie aprovados. Resposta do contrato permanece pendente.

Pix: B-02 passo1 de T1 ainda é dependência. Backend inspecionado continua confiando somente na própria origem; whitelist/CORS/origem Pix/cookie canônico não entregues a T2. Não apontar fetch cross-origin com credentials inadequadas nem relaxar checagem. Pedido detalhado em docs/B-02_T2_DEPENDENCIAS.md. Cópias locais preservadas.

Reversão: revert da propriedade key no input ou do commit desta correção. Infra3343 e banco sintético preservados. Sem merge/push/deploy.
