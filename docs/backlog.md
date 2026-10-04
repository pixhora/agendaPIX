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
