# A5 — revisão focada A2

Alvo: `agenda-dashboard`, `feat/dashboard`, HEAD observado `daf70ee`. URL `http://127.0.0.1:3343/dashboard/services` e `/dashboard/settings`, com businessId da fixture sintética privada. Sessão existente de login SMTP real, sem bypass ou email novo. Não reexecutados gates gerais nem login.

## Prova T3

Comando: `QA_DASHBOARD_FIXTURE=/tmp/agenda-t2-final/fixture.json QA_DASHBOARD_SESSION=/tmp/agenda-t2-final/navigation-state.json node tests/qa/dashboard-a5-proof.mjs`.

Resultado: exit0, `{"cases":8,"persistence":true}`. Oito combinações:375/1280px, claro/escuro, movimento normal/reduzido. Script reutiliza prova versionada do T2, com saídas T3 e tentativa adicional de Enter durante envio pendente. Nenhuma espera fixa ou duração exata.

Screenshots e resultados locais: `dogfood-output/a5-dashboard/`, preservados sem versionar dados sintéticos do proprietário. Captura inspecionada: `services-375-dark-reduce.png`. As demais combinações possuem captura e assertions; não se afirma inspeção visual manual de todas.

- **OK — T2 — `components/dashboard/navigation.tsx:23` e `motion.module.css:14`:** Enter abre; Tab alcança Agenda; Escape fecha e devolve foco ao gatilho. Rascunho de serviço permanece ao abrir/fechar. Menu observa animações reais e aguarda `finished`; reduzido sem animações, conteúdo disponível. Sem overflow nas oito combinações.
- **OK — T2 — `components/dashboard/forms.tsx:21,33`:** Server Action real de serviço: dados permanecem em pending; botão desabilitado; Enter no campo enquanto pendente não duplica request. Uma chamada, feedback após resposta, reload mantém nome; serviço restaurado. Horários salvos/recarregados sem alterar valores, preservados.
- **OK, UI controlada — T2 — `components/dashboard/pix-key-form.tsx:73,76,81`:** uma chamada PUT no envio, pending visível, erro503 recebe foco, campo apagado; PUT200/DELETE200 mostram sucesso após resposta, chave sintética não aparece no texto, remoção devolve foco ao campo. Não é prova de API integrada, autorização ou pagamento.

## Limites e incidente da preparação

Um primeiro experimento forçou `form.requestSubmit()` via JavaScript durante pending e gerou duas Server Actions. Não equivale à interação normal de usuário; não classificado como regressão de animação. Teste final usa Enter real no campo e passa com uma request. A fixture foi restaurada na execução final. Não alterado código de produto.

Origem de login3343/3342 e API Pix ausente são pendências já declaradas pelo autor, não novos defeitos reproduzidos neste delta. Sessão preexistente não comprova login novo. Não se revalida agenda/status fora das duas rotas solicitadas. HEAD observado corresponde ao handoff; não há identificador de build servido exposto para atestar associação criptográfica da URL ao commit.

Nenhum bloqueio novo comprovado no delta A2. Revisão não aprova produção nem substitui integração pendente.
