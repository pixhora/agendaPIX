# Backlog

- Terminal 1: antes do gateway real, definir recuperação de cobrança externa em falha de commit e tratamento operacional de pagamento tardio.
- Terminal 1: implementar gateway real atrás de `PaymentProvider` após validação do fluxo fake.
- Humano + terminal 1: definir retenção de histórico financeiro e exclusão de conta conforme LGPD antes de liberar o produto.
- Terminal 3: substituir o teste do esqueleto pelos fluxos reais de agendamento e pagamento conforme as rotas forem entregues.


## Terminal 2 — Painel do dono

- Aguardar o esqueleto no `master`; depois atualizar `feat/dashboard` e ler os contratos de API e os tokens visuais compartilhados.
- Construir a agenda do dia e da semana, com horários e estados de agendamento definidos pelos contratos.
- Implementar lista de clientes, cadastro de serviços e preços em centavos, e configuração dos horários de funcionamento.
- Integrar o painel às APIs autorizadas por tenant, com estados de carregamento, vazio, erro e sucesso; validar acessibilidade, modo escuro e telas de 375px e desktop.
- Executar `lint`, `typecheck` e `test`, e solicitar revisão ao terminal 6 antes de encaminhar ao humano para merge.

## 2026-10-03 — Achados da verificação T2

- **T1 / bloqueia produção:** sanitizar logs Better Auth/Drizzle em falha do banco; token de sessão aparece nos parâmetros SQL. Reprodução e trecho sanitizado em `docs/VERIFICACAO-T2-2026-10-03.md`.
- **T3:** incorporar as regressões comprovadas do painel à suíte E2E permanente; testes existentes de esqueleto não cobrem formulários e recuperação de erro.
- **T4:** conferir contraste e `color-scheme` dos controles nativos no modo escuro; não houve redesign nesta rodada.

## 2026-10-03 — Propriedade de frontend atualizada

A nova divisão está em `/var/home/matheus/projetos/agenda-backend/docs/EQUIPE.md` e substitui a atribuição anterior a T2 para novas tarefas: T4 possui frontend completo, incluindo dashboard/componentes/integração UI; T3 mantém QA/revisão. Trabalho local existente de T2 é preservado para transferência, não deve ser duplicado. Ver `docs/HANDOFF-T2-T4.md`. T5/T6 seguem planejados e ainda não criados.

## 2026-10-04 — Status atual da seção T2

Atualiza e substitui o checklist histórico acima. T2-B shell/nav entregue em `b7ad242`; T2-C estados/reduced-motion entregue em `19d5562`; T2-A login tokens T4 entregue neste checkpoint. Lint/typecheck/test/build passaram; evidência e limites em `docs/T2-A_LOGIN.md`, `docs/T2-B_SHELL.md`, `docs/T2-C_ESTADOS.md`. Revisão independente do último delta permanece pendente. B-02 autenticado/Pix persistido continua integração separada; não tratar UI/harness como persistência de produção. T2-A não altera backend nem tokens globais/shared.
