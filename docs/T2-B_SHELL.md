# T2-B — Shell e navegação

## Plano

1. Expor as quatro rotas em duas colunas no celular, sem menu que esconda Funcionamento.
2. Preservar Link, tenant selecionado e aria-current; navegação estática não exige hidratação própria.
3. Ajustar hierarquia do título e seletor para nomes longos, sem alterar tokens ou componentes compartilhados.
4. Provar 375/390/1280, teclado, claro/escuro e reduced-motion; executar gates.

B-02 permanece não commitado e separado. Nenhuma mudança de auth, backend ou contrato faz parte desta entrega.

## Entrega e prova

- `components/dashboard/navigation.tsx`: quatro destinos sempre visíveis, grid de duas colunas mobile e flex com quebra no desktop. Sem estado/listeners/dropdown; Server Component.
- `components/dashboard/shell.tsx`: hierarquia tipográfica existente, seletor com nome longo contido, foco visível e valor sincronizado com negócio carregado. Links preservam businessId codificado e aria-current.
- `pnpm lint`: exit0; `pnpm typecheck`: exit0; `pnpm test`:79/79 na árvore atual, incluindo seis testes do B-02 não commitado. Não confundir validação da árvore com aprovação dessa integração.
- `QA_SHELL_HTML=/tmp/agenda-t2-shell.html pnpm exec vitest run --config tests/dashboard-shell.config.ts`:5/5.
- `node tests/dashboard-ui/shell-browser.mjs`:6/6 (375/390/1280, claro/escuro, reduced-motion). Quatro links visíveis,44px, teclado/foco, tenant no destino e zero overflow/pageerror. Capturas e resultados em `docs/evidencias/dashboard-shell/`.
- Browser usa markup SSR do componente real e CSS servido pelo processo3343, em documento interceptado. Não prova sessão, CRUD, hidratação Next ou integração backend.
- Tentativas iniciais da infraestrutura de prova falharam por CSS cross-origin e charset ausente; documento corrigido para mesma origem e UTF-8. Nenhuma redução do critério.
- Revisão designada ainda pendente. Rollback: revert deste commit. Tokens/shared/auth/APIs não alterados neste delta.
