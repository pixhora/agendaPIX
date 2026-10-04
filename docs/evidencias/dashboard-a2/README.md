# A2 — Painel real

Worktree `agenda-dashboard`, branch `feat/dashboard`, base `9906d85`. Servidor efetivo: http://127.0.0.1:3343. Tokens A1 acordados com Antigravidade em `88a4d49`; CSS Module local, sem alteração dos compartilhados.

## Prova executada

- `pnpm lint`: zero erros/warnings.
- `pnpm typecheck`: passou.
- `pnpm test`: 73/73 testes, sete arquivos.
- `node node_modules/next/dist/bin/next build --webpack`: passou, build final na própria worktree. Servidor preservado; login e health HTTP200 depois do build. Build isolado também passou. `pnpm build` na cópia com node_modules symlink foi recusado pela instalação automática do pnpm; nenhuma dependência nova instalada.
- `pnpm exec playwright test --config tests/e2e/dashboard-login.config.ts`: 8/8, 4,6s. Estados de envio controlados, sem alegar SMTP novo.
- `QA_DASHBOARD_FIXTURE=/tmp/agenda-t2-final/fixture.json QA_DASHBOARD_SESSION=/tmp/agenda-t2-final/navigation-state.json node tests/e2e/dashboard-motion-proof.mjs`: passou. Usar somente fixture e sessão sintéticas obtidas por login real; arquivos privados não fazem parte desta entrega.

O script cobre 12 combinações de serviços: 375/390/1280px, claro/escuro, movimento normal/reduzido. Observa animações CSS em execução e aguarda `finished`, sem sleeps/durações exatas. Testa teclado/Escape, links ocultos inertes, rascunho preservado e ausência de overflow. Screenshots do menu e páginas, mais resultados, estão nesta pasta. Status da agenda usa somente dados recebidos do servidor; transição de cor não adiciona atualizações automáticas.

Serviço de fixture foi salvo, recarregado e restaurado; horários foram salvos e recarregados sem mudar valores. Request real de serviço foi retido antes de encaminhar, comprovando pending, dados preservados e uma chamada; resposta continuou sendo da Server Action real.

Pix teve HTTP controlado para PUT503, PUT200 e DELETE200: pending, mensagem de erro com foco, sucesso após resposta, limpeza do campo e foco depois de remover. Esses testes comprovam UI; a API Pix continua ausente desta branch. Nenhuma chave completa foi renderizada ou persistida em state/storage/log.

## Limites e responsáveis

- T1/operador: integração da API Pix e origem Better Auth3343/3342. Login3343 continua com bloqueio operacional conhecido; esta prova usa sessão SMTP real preexistente, sem bypass. Tentativa de login3342 nesta passagem não mostrou status; não há novo envio SMTP comprovado.
- Prisma/CODEFICADO: revisão do delta A2 visual e funcional. Ainda não alegada aprovação externa.
- T2: corrigir somente bloqueios reproduzidos da revisão. Sem merge/push.
