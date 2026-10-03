# PEDIDOS ENTRE TERMINAIS

Auditoria de 02/10/2026. Equipe operacional: somente Terminais 1–4, conforme instrução atual do humano. Este registro substitui encaminhamentos antigos a terminais inexistentes; preserva abaixo suas pendências úteis. Nenhuma mensagem externa enviada nesta execução.

## P01 — Terminal 1 → Terminal 3: revisão técnica pendente

Estado: pendente. Revisar base, auth, migrations/seed, isolamento, concorrência, PaymentProvider e webhook do commit auditado `8783cc5`. Os pedidos antigos de revisão não tiveram ok registrado; ficam sob responsabilidade do Terminal 3. Retornar bloqueia/melhorar/ok com arquivo e linha; autor corrige. Tarefas Q00/Q01/Q02.

## P02 — Terminal 1 → Humano; Terminais 2/4: base e contratos

Estado: pendente. Esta worktree está em feat/backend; master contém esqueleto; main não existe e nenhum remote foi observado. Confirmar branch-base e integração antes de novas mudanças entre worktrees. Fetch e tentativa de rebase main não concluíram e foram interrompidos; atualização não comprovada. Humano continua responsável por merge. T1 entrega contratos B00/B02–B04; T2 informa necessidades em D00; T4 usa APIs públicas existentes e fornece tokens F00. Não reconstruir endpoints públicos.

## P03 — Terminal 1 → Terminal 3/Humano: ambiente e SMTP

Estado: pendente. Lint/typecheck/48 unitários passam. Integração (25) e E2E do esqueleto (2) passaram na repetição escalonada. Build continua falhando por EPERM ao abrir porta interna do Turbopack. Reproduzir em ambiente adequado, identificar causa e encaminhar ao T1 se houver correção de infraestrutura. Validar envio de link mágico com SMTP real de testes sem publicar credenciais ou tokens. Q00/B05.

## P04 — Terminal 1 → Humano; Terminais 2/4: gateway e exceções financeiras

Estado: decisão necessária. Selecionar Asaas ou Mercado Pago conforme AGENTS, conta/recebedor do sinal, disponibilizar credenciais por canal de segredos e definir autorização/valor da prova real. Aprovar procedimento de pagamento tardio, recuperação de cobrança externa após falha de commit e eventual devolução antes de produção. T1 implementa B08–B11. T4 identifica fake como simulação e consome status real; T2 exibe ocorrência sem inventar regra. Fake atual não paga em banco.

## P05 — Terminal 1/4 → Humano: LGPD

Estado: decisão necessária. Fornecer política de privacidade aprovada e regras de retenção financeira/exclusão da conta. RESTRICT atual impede exclusão financeira silenciosa. T1 implementa B06; T4 publica texto e entrada F08. Não gerar texto legal nem prazo por suposição.

## P06 — Terminal 1/2/4 → Humano: trial e assinatura

Estado: decisão necessária após fluxo crítico. AGENTS prevê trial de 7 dias, R$29 base/R$59 completo e cobrança mensal Pix/cartão. Aprovar composição dos planos, canal inicial, renovação, inadimplência, cancelamento e acesso após trial sem inventar regras. T1 B12/B13, T2 D06, T4 F05 usam a mesma decisão. Taxa opcional não é requisito aprovado de implementação.

## P07 — Terminal 1 → Humano/Terminal 3: produção

Estado: pendente. Disponibilizar VPS/Coolify, domínio, configuração HTTPS/SMTP/gateway e segredos por canal adequado, além de autorização de deploy quando preparado. T1 B14 prepara container, migration, health e backup/restauração; T3 Q05 prova fluxo no ambiente publicado. Compose atual só atende Postgres local.

## P08 — Terminal 1 → Terminais 2/3/4: demo e APIs disponíveis

Estado: dependência documentada. Seed existente prepara barbearia-demo, serviços e horários fictícios; login dono-demo@example.com depende de SMTP de testes. B01 comprova seed. T4 F01–F03 consome contrato público preservando Idempotency-Key e bearer; T2 usa APIs próprias B02–B04; T3 Q03 constrói jornada real. Dados demonstrativos não definem preços ou clientes comerciais.
