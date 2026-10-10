# PEDIDOS ENTRE TERMINAIS

## P09 — T1 → Humano/T2/T4: chave do Pix e confirmação

T1 implementa armazenamento cifrado da chave Pix por negócio e API autenticada. A chave permite endereçar um Pix estático, mas não confirma recebimento. Definir se o MVP aceita confirmação manual pelo dono ou exige provedor com webhook que pague na conta do estabelecimento. Até essa decisão, não trocar provider fake, não exibir QR pagável e não confirmar reserva pela exibição do QR. T2 integra o campo somente após contrato backend. T4 mantém mock identificado.

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

Estado: decisão necessária após fluxo crítico. AGENTS prevê trial de 7 dias, R$49 base/R$79 completo e cobrança mensal Pix/cartão. Aprovar composição dos planos, canal inicial, renovação, inadimplência, cancelamento e acesso após trial sem inventar regras. T1 B12/B13, T2 D06, T4 F05 usam a mesma decisão. Taxa opcional não é requisito aprovado de implementação.

## P07 — Terminal 1 → Humano/Terminal 3: produção

Estado: pendente. Disponibilizar VPS/Coolify, domínio, configuração HTTPS/SMTP/gateway e segredos por canal adequado, além de autorização de deploy quando preparado. T1 B14 prepara container, migration, health e backup/restauração; T3 Q05 prova fluxo no ambiente publicado. Compose atual só atende Postgres local.

## P08 — Terminal 1 → Terminais 2/3/4: demo e APIs disponíveis

Estado: dependência documentada. Seed existente prepara barbearia-demo, serviços e horários fictícios; login dono-demo@example.com depende de SMTP de testes. B01 comprova seed. T4 F01–F03 consome contrato público preservando Idempotency-Key e bearer; T2 usa APIs próprias B02–B04; T3 Q03 constrói jornada real. Dados demonstrativos não definem preços ou clientes comerciais.

## Reorganização — limites de uso e conexões

T4 Antigravidade, T5 Trilha e T6 Prisma atingiram limite de uso; manter sessões e aguardar liberação, sem contornar. Missões em docs/EQUIPE.md. T2 agora conectado diretamente a T4 para transferência do painel. CODEFICADO e Codex #2 não alcançáveis diretamente por Codex; confirmar acesso via pares antes de declarar alinhamento/limpeza concluídos.

## Layout da escolha de horário — T1 para T4/T3

Evidência do humano: `/tmp/Maestri-drops/1c2a9239-d492-495c-8a7b-691f64964697.png`. Em agenda-booking-ui/components/booking/StepSlot.tsx:188, régua usa `no-scrollbar`; definição não encontrada em app/globals.css. Barra horizontal nativa clara aparece no tema escuro. T4 recebeu correção no componente real, preservando rolagem acessível e foco. T3/CODEFICADO recebeu reprodução e QA em 375px/desktop, claro/escuro. Contraste do badge ativo e topo cortado na imagem requerem confirmação no navegador. Entrega e validação pendentes; não afirmar resolução antes da prova.

## Preços aprovados — T1 para T5/T4/T2 e QA

O humano aprovou alteração dos valores mensais para R$49 no plano base e R$79 no plano completo. Fonte: docs/PRECOS.md. T5 atualiza landing/pricing/CTA/onboarding; T4 e T2 alinham demais referências em suas áreas, sem edição concorrente. T3/T6 conferem consistência. Valores financeiros: 4900 e 7900 centavos. Este pedido altera preços, não define benefícios, taxas, condições de renovação ou autorização para cobrar clientes existentes. Trial de 7 dias permanece.

## 2026-10-04 — T1 para Hermes/revisores/consumidores: entrega auth e plano de integração

Backend `02c5b27` corrige a falha de Error/stack reproduzida no handler real. Codex Revisor aprovou o delta (OK; 9 provas do handler). Cursor classificou MELHORAR: consumidores ainda têm cópias antigas; recomenda um app Next final integrado, preservando Server Actions. A proposta anterior B02-D de aplicações separadas deve ser reconciliada pelo Hermes antes de alterar origens/CORS. Provas T1: lint/typecheck, 60 unitários, 26 integrados, 2 E2E básicos, build Turbopack e 11 verificações HTTP aprovados. Estado bancário continua fake.

Plano: `docs/PLANO_BACKEND_HERMES.md`. Corresponde à correção T-01/B-01 já pedida; não duplicar implementação. T2/T4/T5 devem incorporar a proteção aos seus consumidores preservando mudanças locais, depois de revisão; T1 não modifica suas worktrees. Quatro servidores de desenvolvimento disponíveis não equivalem a quatro aplicações obrigatórias em produção. Preservar contrato administrativo Server Actions; comparar composição em um app Next final antes de adicionar CORS/REST/aplicações paralelas.

Relatórios permanecem em arquivos/fila; entregar ao Hermes somente quando idle ou após conclusão explícita do lote atual. Não reenviar por timeout. Não depender de `maestri ask Codex` enquanto o nome for ambíguo: usar nota compartilhada/arquivo para T1.

## 2026-10-04 — Incidente de acesso por e-mail (T1/T5)

Imagem 95bbb63f-199e-49eb-b67a-176d844da992: mensagem localizada no StepAccount de conversion/booking-ui. Na landing3005, logs do processo mostram POST magic-link500 e ZodError no campo BETTER_AUTH_SECRET; conversion não possui .env/.env.local. Falha ocorre antes de envio SMTP, não comprova falha do provedor. T5 recebeu correção operacional da sua worktree, sem simular sucesso ou alterar UI. Painel3343 usa coletor SMTP sintético25243: armazena mensagens locais, não entrega no Gmail. Backend SMTP localhost1025 sem listener. Serviço/credencial legítimos de entrega ainda não disponíveis nesta auditoria; usuário consultado sobre provedor, sem solicitar segredo no chat. Não declarar entrega real nem copiar fixture QA como configuração de produção.

Contexto Hermes T1-B02-1 recebido: B-01 já concluído02c5b27 e revisão OK; whitelist/CORS e fixture permanecem etapa separada dependente de contrato e conciliação arquitetural. Prioridade atual preservada: resolver acesso por e-mail.

Atualização Resend: usuário confirmou provedor. Configuração privada existente em booking-ui autenticou com nodemailer.verify (SMTP_AUTH_OK); nenhum e-mail foi enviado nessa prova. Backend .env recebeu somente campos SMTP existentes, mantendo auth/DB e permissões0600. T5 recebeu evidência e deve configurar seu runtime com auth/DB legítimos e SMTP Resend, provar envio no handler e preservar valores fora de logs/documentos/git. Não aguardar B02/CORS para corrigir fluxo local já existente.

Fechamento do incidente Resend: T5 configurou ambiente privado da landing com auth/DB existentes e SMTP Resend. Consulta independente à API Resend confirmou mensagem nova para o endereço da imagem em2026-10-04T14:47:20Z, status delivered, assunto de acesso e URL magic-link/verify presentes; corpo/token/credenciais não registrados. Falha original BETTER_AUTH_SECRET ausente resolvida; coletor sintético não foi contado como entrega real. Sem mudança de layout ou nova dependência. Resend ainda sem domínio próprio verificado nesta conta; homologar domínio antes de abrir cadastro a outros destinatários. Contexto B02 mantido separadamente.

## 2026-10-04 — T1 → T3/revisor: base recente para revalidação

Base c407968; commits 29f3b75 (origens/CORS), 1332daa (artefato fixture), c407968 (limite de reservas/prontidão). Nesta retomada lint/typecheck e 82 unitários passaram; quatro superfícies HTTP disponíveis fora do sandbox. Revisão independente destes deltas e integração dos consumidores pendentes. Conferir produção sem origens locais, isolamento/concorrência do limite e readiness sem detalhes sensíveis. Pedido registrado em arquivo; nenhuma sessão contatada.

## 2026-10-04 — Hermes → T4/T5/T6 (e Codex): skills novas + plano de telas

Estado verificado por Hermes (Operação/Performance), com evidência: sistema local no ar 4/4 (`run_system.py --check` → 3000/3001/3005/3343 OK); `/api/ready` → ready; booking público `barbearia-demo` servindo slots reais. Visual atual ainda é o provisório: Arial de sistema, um azul `#1D4ED8`, `globals.css` só com `prefers-color-scheme`, `design-tokens.md` marcado "provisório", sem elemento-assinatura — a "cara de template" que o AGENTS §6 proíbe.

Skills instaladas para os agentes: 36 do repo `mattpocock/skills` (MIT, auditado antes de instalar: sem installer executável, sem coleta de credencial, sem POST externo). Caminhos: `~/.codex/skills` (T1–T3), `~/.gemini/config/skills` (T4–T6), `~/.claude/skills`, acervo mestre `~/.agents/skills`. Adaptação obrigatória: essas skills vêm do Claude Code e citam "Skill tool" — no Codex/agy invocar pelo nome; e assumem `docs/agents/issue-tracker.md`, que NÃO existe: rodar `setup-matt-pocock-skills` uma vez antes de usar `to-spec`/`to-tickets`/`triage`/`wayfinder`/`code-review`.

Arquivos: `docs/EQUIPE_SKILLS_MATTPOCOCK.md` (mapeamento agente→skill + pipeline wayfinder→to-spec→to-tickets→implement/tdd→code-review→retro), `docs/HANDOFF_FRONTEND_T4_T5_T6.md` (skill por passo, dependências, definição de pronto), `docs/PLANO_TELAS_FRONTEND.md` (design system), `docs/PLANO_AGENTES_MVP.md` (plano por agente e bloqueadores reais).

Dono: T4 conduz o design system (tokens finais + `.dark` próprio + elemento-assinatura na régua de horários do booking), corrige `agenda-booking-ui/components/booking/StepSlot.tsx:188` (barra nativa no tema escuro) e prova em navegador 375/1280, claro/escuro. T5 consome os tokens de T4 — não criar design system paralelo. T6 audita com arquivo:linha + viewport, sem reescrever código alheio. Encaminhamento: Maestri/Codex.

Limite desta entrega: a sessão Hermes NÃO tem conexões no canvas (`maestri list` vazio; transporte OK, `maestri debug` status 200), então não foi possível enviar por `maestri ask`. Entrega feita por arquivo, conforme `docs/HANDOFFS.md`. Nenhuma worktree de frontend foi tocada e nenhum processo de outro dono foi iniciado ou parado.

## 2026-10-04 — Codex → T6/Prisma: correções documentais T6-A

No relatório `docs/AUDITORIA_T6A_TELAS_2026-10-04.md`, corrigir síntese para 10 OK (tabela contém 10 OK e 1 MELHORAR, sem BLOQUEIA). Substituir as duas atribuições do redesenho de login ao commit `206a5a3` por `9e24951` (`fix: align dashboard login with product identity`). Conferência dos commits confirma que `206a5a3` trata da data da agenda. Preservar evidências e escopo; pedido registrado por arquivo, sem edição na worktree T6 ou mensagem externa.

## 2026-10-04 — T1 → Hermes / Codex Revisor: entrega 8349c54

Atualização posterior: revisão independente de 8349c54 recebida com OK, nenhum bloqueador; diff --check limpo e testes focados 20/20 em snapshot exclusivo. Pendência de revisão encerrada. Handoff útil a Hermes permanece pendente de disponibilidade; aplicação real da migration não autorizada nesta recepção.

Commit `8349c54` finaliza CORS público/onboarding idempotente/migration0006 e prova origem única de produção. pnpm lint/typecheck exit0; test88/88; verificação isolada aplicou migrations duas vezes, integração passou e banco temporário removido. Relatório versionado: docs/ENTREGA_T1_ORIGINS_ONBOARDING.md. Banco compartilhado preservado. Revisão enviada ao Codex Revisor e execução confirmada pelo terminal; parecer pendente. Envio via `maestri ask "Hermes"` executado, porém resposta exibiu limite de créditos OpenRouter/HTTP402; depois Hermes desapareceu de `maestri list` e check retornou Terminal not found. Recebimento útil não confirmado. Parado nesse handoff conforme limite de cota; não trocar provedor nem recriar sessão para contornar. Aguardar disponibilidade de Hermes para entrega/revalidação. Sem merge/push/deploy.

## 2026-10-10 — contrato do alias público

`docs/CONTRATOS.md` (perfil do negócio): o cache de slug guarda só alias positivo por 60s. Negativo e erro de banco não entram. Slug ausente em `businesses` lê `readAliasTarget` sem cache. Falha dessa consulta no proxy e em `/api/public/{slug}/...` segue sem redirect e sem detalhe. Sem migration e sem mudança em produção neste pedido.

## P-DASH-V2 — 2026-10-05 — Humano / dono do backend

Pedido: quando o PR de integração de `feat/backend` abrir/mergiar, avisar para rebasear `feat/dashboard-v2`. Não atualizar nem mergear o PR #1 (`feat/dashboard`). Registrar colisão de rota com `feat/conversion` (`app/dashboard/page.tsx` placeholder) sem alterar aquela branch.

## P-PERF — 2026-10-10 — leitura pública mais curta

`GET /api/public/[slug]/availability` ganhou `dates` opcional (até 7 dias) e o campo `days` só quando há mais de uma data. O catálogo público passa a ser cacheado no servidor por 30 s, com invalidação imediata nas gravações do dono. A ocupação dos horários continua ao vivo e o `Cache-Control` da resposta continua `no-store`. Migration `0019_read_path_indexes` (o `0018` está na branch `cursor/business-profile-backend-ad02`).
