# T2-C — Estados e movimento

## Plano

1. Preservar vazios e confirmações reais existentes; não criar sucesso simulado.
2. Retirar confirmação antiga ao editar serviços/horários/Pix novamente, mantendo valores e foco.
3. Explicitar dias vazios na semana e ausência de chave/dias selecionados.
4. Provar estados com componentes reais e respostas controladas,375/desktop e reduced-motion; gates e commit separado.

## Mudanças

- `components/dashboard/forms.tsx`: sucesso antigo desaparece ao editar novamente, sem apagar valores/foco. Confirmação continua vindo exclusivamente da Server Action; aria-atomic permite anúncio completo. Horários sem dias selecionados explicam o efeito de salvar a agenda fechada.
- `components/dashboard/pix-key-form.tsx`: estado sem chave explícito; confirmação anterior desaparece ao digitar outra chave/tipo. Segredo continua input não controlado, limpo após tentativa; contrato auth/Pix não alterado.
- `app/dashboard/(owner)/page.tsx`: cada dia sem reservas fica identificado na semana inteira vazia. Dia individual preserva uma mensagem principal e ação para funcionamento.
- `motion.module.css` já desativa animações/transições/transformações sob prefers-reduced-motion. Regra existente foi provada; nenhuma alteração artificial de CSS/tokens/shared.

## Prova real da correção

Reprodução browser na base230b569: salvar serviço e editar nome novamente deixava “Serviço salvo.” visível. `QA_STATES_BASELINE=230b569 node tests/dashboard-ui/states-browser.mjs` falha na expectativa de nenhum status após editar: esperado0, observado1. O harness carrega o forms.tsx histórico com git show, sem sobrescrever produto ou dados.

Depois da correção: `node tests/dashboard-ui/states-browser.mjs`,8/8:375/1280 claro/escuro, movimento normal/reduzido. Componentes React reais, estado pending/success/error/recovery, valores e foco preservados, confirmação retirada ao editar serviço/horários/Pix, chave limpa após resposta, vazios e zero overflow/pageerror. Browser fecha seu servidor Vite exclusivo no finally. Não usa3343/backend/SMTP/DB ou chama APIs reais; respostas de ações/Pix são controladas exclusivamente no harness e não equivalem à prova de persistência.

`pnpm exec vitest run --config tests/dashboard-states.config.ts`:2/2, dia/semana vazios. `pnpm lint`:exit0; `pnpm typecheck`:exit0; `pnpm test`:79/79. Screenshots/resultados: docs/evidencias/dashboard-states. Build e revisão independente não realizados nesta rodada; produção não declarada.

## Estado dos planos

T2-B entregue em b7ad242; T2-C implementado e validado, revisão pendente; T2-A aguardando tokens T4-A, sem redesenhar login antecipadamente. B-02 consumidor230b569 permanece com prova autenticada pendente por fixture/runtime ausentes; não tratado como sucesso de produção. Sem backend/schema/API nova, merge/push/deploy ou alteração de worktree alheia.

Rollback: revert deste commit T2-C. Pendências documentais antigas preservadas.
