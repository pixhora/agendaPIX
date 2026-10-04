# Equipe — atualização solicitada pelo usuário

Esta configuração substitui a divisão anterior para novas tarefas. T1–T3 continuam Codex. O Antigravidade existente assume T4; criar somente dois terminais novos, T5 e T6, ambos Antigravity. Não duplicar T4.

## Responsabilidades

| Terminal | Papel | Área |
| --- | --- | --- |
| T1 | Backend e fundação | Banco, migrations, autenticação, autorização, APIs, regras de negócio, reservas, tenants, Pix, webhooks e assinatura. |
| T2 | Painel do dono | CODEXADO mantém agenda, clientes, serviços/preços e horários do dashboard real. T4 fornece tokens/componentes compartilhados por acordo prévio; sem edição concorrente. |
| T3 | QA e revisão técnica | Testes unitários/integrados/E2E, segurança, regressão e revisão técnica de backend e frontend. |
| T4 | Frontend Engineer | Booking público, dashboard, componentes compartilhados, design system, responsividade, Preview Mode, integração com APIs e estados loading/error/empty/success. |
| T5 | Product/Conversion Designer | Landing, pricing, CTA, onboarding, cadastro, ativação do primeiro negócio, fluxo até primeira reserva, copy e redução de fricção. |
| T6 | UX/UI Auditor | Auditoria independente de consistência, mobile, ações visíveis, comprimento dos fluxos, hierarquia, estados, duplicação, acessibilidade, identidade e conversão. |
| Cursor (`cursor-tech-lead`) | Tech Lead / Integration Architect | Análise transversal de arquitetura, contratos, segurança, pagamentos, regressões e coerência entre T1–T6. Consultivo; não substitui os donos de implementação. |

## Cursor — fluxo de revisão arquitetural

1. Após alteração importante, o Maestri solicita auditoria com commit e escopo.
2. Cursor consulta apenas seções pertinentes desses documentos e inspeciona commit, arquivos e dependências diretas do escopo.
3. Verifica contratos e dependências afetadas, inclusive auth/tenant, disponibilidade/reservas, pagamentos/webhooks e testes; classifica `OK`, `MELHORAR` ou `BLOQUEIA` com evidências.
4. Quando o problema tem dono claro, recomenda agente, prioridade, arquivos e correção. O Maestri decide e encaminha; Cursor não assume tarefas T1–T6 automaticamente.
5. O Maestri pode autorizar implementação de correção transversal sem dono claro. Após a correção, Cursor valida novamente e informa testes executados e pendentes.

Cursor é consultivo: não cria tarefas, envia mensagens, interrompe sessões ou faz merge/push/deploy por iniciativa própria. Relatório: resultado; análise/evidências; problemas com prioridade, arquivo e impacto; impacto em T1–T6; recomendação; ação; validação.

## Handoffs entre agentes

Siga `docs/HANDOFFS.md`: escopo e critério explícitos, inspeção só de arquivos/dependências diretas, mensagens em Caveman ultra e resposta com commit/prova/bloqueio.

A instrução posterior do humano “você cuida do dashboard” mantém CODEXADO como responsável pelo painel existente. T4 concentra booking e componentes compartilhados. Qualquer transferência futura deve ser explícita; preservar trabalho em andamento. T5 implementa páginas de aquisição/ativação reutilizando componentes e tokens de T4. T6 não implementa funcionalidades nem reescreve trabalho dos autores.

## Organização de trabalho

- T4 permanece em `feat/booking-ui` / `agenda-booking-ui`.
- T5 (Trilha): worktree e branch criadas a partir de `a134216`; `agenda-conversion` / `feat/conversion`.
- T6 (Prisma): worktree de auditoria criada a partir de `a134216`; `agenda-ux-audit` / `feat/ux-audit`.
- Não reaproveitar nem alterar `agenda-review` sem verificar seu dono e trabalho pendente.
- T4 possui tokens globais e componentes compartilhados. T5 solicita ajustes compartilhados a T4; não cria design system paralelo.
- T1 possui contratos/backend. T4/T5 não alteram auth, banco ou pagamento; registram dependências em pedidos.
- T6 audita commits/rotas identificados e encaminha correções a T4/T5/T1/T2 conforme responsabilidade. T3 verifica comportamento e segurança independentemente de T6.
- Cada agente trabalha somente em sua worktree. Sem push ou merge nesta configuração.

## Prompt inicial — T4

Você é T4 — Frontend Engineer. Dono: booking, dashboard compartilhado acordado com T2, design system, Preview e integração visual com APIs. Leia AGENTS.md; consulte só escopo relevante de docs/EQUIPE.md e docs/CONTRATOS.md. Verifique branch/commit e arquivos-alvo; siga docs/HANDOFFS.md. Mobile 375px primeiro; adapte layout inteiro se necessário. Não altere backend/pagamentos. Prove loading/empty/error/success, acessibilidade e desktop. Mensagens Caveman ultra; sem narração. Preserve outras worktrees.

## Prompt inicial — T5

Você é T5 — Product/Conversion Designer. Dono: landing, pricing, CTA, onboarding, cadastro, ativação, copy e conversão. Leia AGENTS.md; consulte só seções e contratos envolvidos. Verifique branch/commit e arquivos-alvo; siga docs/HANDOFFS.md. Implemente mudanças mobile-first e adapte layout inteiro quando necessário. Não invente preços, benefícios, provas sociais, texto legal ou integrações. Não prometa Pix automático sem confirmação real. Use sistema visual de T4; não duplique componentes. Prove fluxo em 375px e desktop. Mensagens Caveman ultra; sem narração. Preserve outras worktrees.

## Prompt inicial — T6

Você é T6 — UX/UI Auditor. Leia AGENTS.md; consulte somente a tela, rota e contrato auditados. Siga docs/HANDOFFS.md. Não implemente nem reescreva código. Audite telas reais, prioridade 375px; reporte apenas achados provados com branch/commit, URL/viewport, arquivo/linha, impacto e correção recomendada. Classifique bloqueia/melhorar/ok. T3 cobre segurança/E2E. Revalide após correção. Mensagens Caveman ultra; sem narração.

## Estado da criação

Maestro confirmado pelo CLI. Dois terminais criados com preset Antigravity e papéis próprios:

- Trilha: T5 — Product/Conversion Designer, `feat/conversion`, `/var/home/matheus/projetos/agenda-conversion`.
- Prisma: T6 — UX/UI Auditor, `feat/ux-audit`, `/var/home/matheus/projetos/agenda-ux-audit`.
- Ambos conectados a Codex e Antigravidade, e entre si; Prisma conectado também a CODEXADO para auditoria de transição do painel.
- Antigravidade existente segue T4; não foi reiniciado nem duplicado.
- Base dos novos terminais: `a134216ca473144ff97acbaaf1fd26689002ad83` (frontend atual). Sem cópia de `.env` ou credenciais de outra worktree.
- Criação de terminal não prova execução nem aprovação de checks; relatórios devem registrar evidências reais.

## Reorganização e limpeza visual

- Sessões, histórico de conversa, missões, branches e servidores devem ser preservados. Não usar /clear, /reset, reinício, role assign ou troca de modelo para limpar telas. Ctrl+L apenas para atualização/limpeza visual da aplicação.
- T2 CODEXADO conectado diretamente a T4 Antigravidade; handoff não depende mais de repasse.
- T4/T5/T6 exibem limite de uso e devem aguardar liberação de cota. Não contornar nem presumir recebimento de novas tarefas.
- CODEFICADO aparece conectado a Antigravidade, mas acesso/conexão direta por Codex foi rejeitado pelo CLI; missão QA preservada e limpeza não realizada diretamente.
- Codex #2 aparece na lista, mas check direto retorna No connection. Identidade e checkpoint devem ser confirmados por CODEXADO antes de qualquer mudança de missão. Não remover terminal desconhecido.
- Prompts e papéis T5/T6 persistem nos role presets; configuração completa permanece neste documento.

## Coordenação ativa — 2026-10-03

Codex coordena entregas. Atividades enviadas por Maestri aos seis agentes existentes, sem criar ou reiniciar terminais. Caveman ultra solicitado a todos; execução/recebimento deve ser comprovada individualmente. Configuração abaixo substitui notas antigas de indisponibilidade e acesso.

- CODEXADO: concluir painel real; contrato com Server Actions aprovado, sem REST paralelo.
- CODEFICADO: conexão direta restaurada; regressão booking/Preview, painel e onboarding conforme entregas.
- Codex Revisor: nome único da sessão em agenda-review, antiga Codex #2; revisão técnica independente.
- Antigravidade: corrigir régua de datas e concluir booking real/Preview/componentes compartilhados.
- Trilha: landing e onboarding/ativação, coordenando arquivos já existentes com T4.
- Prisma: auditoria UX/UI baseada em evidências e revalidação, sem implementar funcionalidades.
- Codex/T1: corrigir vazamento residual confirmado no handler Better Auth, alinhar contratos compartilhados e remover bloqueios backend do fluxo real.

Critério de entrega: commit identificado, fluxo funcional comprovado, gates adequados e revisão sem bloqueios. Preview e gateway fake não comprovam produção. Gateway/recebedor/credenciais, políticas financeiras, composição de assinatura e implantação continuam dependências registradas; não inventar decisões.
