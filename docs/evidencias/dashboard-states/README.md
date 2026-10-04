# T2-C — Prova isolada dos componentes reais

Executar `node tests/dashboard-ui/states-browser.mjs` na worktree. Usa Vite já instalado como dependência do Vitest, porta aleatória própria, React real, CSS do produto e Server Actions/Pix substituídos somente no harness. Sem novas dependências, dados/sessão/backend/email ou pagamentos.

8/8 cenários375/1280, claro/escuro, prefers-reduced-motion reduce/no-preference. Screenshots e results.json anexos. Provas: feedback após resposta, ausência de sucesso antigo após editar, recuperação de erro, foco/valores, agenda fechada, Pix sem configuração e input limpo, zero overflow/pageerror. Reduced-motion confirmou animation-name:none e transition-duration:0s.

Baseline reprodutível: QA_STATES_BASELINE=230b569 node tests/dashboard-ui/states-browser.mjs. Falha esperada depois de editar nome após salvar: status esperado0/observado1. Versão corrigida passa. Prova integrada de persistência e revisão independente continuam pendentes.
