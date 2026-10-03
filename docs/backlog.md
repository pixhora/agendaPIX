# Backlog

- Terminal 1: antes do gateway real, definir recuperação de cobrança externa em falha de commit e tratamento operacional de pagamento tardio.
- Terminal 1: implementar gateway real atrás de `PaymentProvider` após validação do fluxo fake.
- Humano + terminal 1: definir retenção de histórico financeiro e exclusão de conta conforme LGPD antes de liberar o produto.
- Terminal 3: substituir o teste do esqueleto pelos fluxos reais de agendamento e pagamento conforme as rotas forem entregues.

## Terminal 3 — Testes e QA

- Aguardar o esqueleto no `master` antes de escrever código; depois, ler os contratos de API e pagamento.
- Criar testes Playwright do fluxo de serviço, horário, dados do cliente, sinal por Pix e confirmação, incluindo erros e pagamento pendente.
- Revisar as entregas dos terminais 4 e 5 em mobile de 375px e desktop: acessibilidade, estados de tela, modo escuro e regressão visual.
- Validar landing e onboarding após o fluxo crítico; registrar achados como **bloqueia**, **melhorar** ou **ok**, com arquivo e linha, para o autor corrigir.
- Executar `lint`, `typecheck`, `test` e os testes e2e disponíveis antes de concluir a QA.

## Terminal 3 — Plano de testes Pix (2026-10-02)

- Criar dados isolados no Postgres para exercitar as APIs HTTP reais com Playwright.
- Cobrir reserva, pagamento fake e confirmação por webhook assinado.
- Verificar horário ocupado e duplicação de webhook com persistência e auditoria.
- Documentar execução e validar e2e, lint, typecheck e testes unitários.
