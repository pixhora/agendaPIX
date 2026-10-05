# Plano de animações da interface

Pedido autorizado em 2026-10-04. Escopo exclusivo de frontend; preservar contratos, autenticação e regras de pagamento. Implementar nas próprias worktrees. Não é produção de vídeo.

## Direção compartilhada

Animação comunica seleção, progresso e resultado. Preservar identidade visual aprovada. Usar CSS nativo para interações simples; se houver biblioteca de movimento instalada, reutilizá-la onde necessário. Não adicionar dependência apenas para esta rodada.

T4 define tokens de duração: 120ms para feedback, 180ms para abertura e 240ms para troca de passo; easing consistente. Preferir opacity/transform e deslocamentos pequenos (até 8px). Evitar transition-all, animação contínua decorativa, parallax, brilho em loop, animação de altura/largura e entrada em cada card. Hover apenas em dispositivo compatível. Nenhuma interação espera a animação terminar para funcionar.

Respeitar prefers-reduced-motion: remover deslocamentos, loops e entradas; manter feedback estático e conteúdo imediatamente disponível. Carregamento nunca depende somente de um spinner. Preservar foco, labels, leitura por tecnologia assistiva e alvos de toque >=44px. Transições não remontam formulários de forma que apaguem dados, nem disparam solicitações repetidas. Sem flashes e sem deslocamento de layout induzido pela animação.

## A1 — T4 Antigravidade: tokens e booking

- Arquivos iniciais: agenda-booking-ui/app/globals.css; components/booking/BookingFlow.tsx, StepProgress.tsx, StepService.tsx, StepSlot.tsx, BookingConfirmation.tsx; components/preview/PreviewBookingFlow.tsx.
- Dependência: inspecionar estados e transições existentes antes de adicionar movimento; publicar tokens/especificação para T2/T5.
- Implementação: feedback de serviço/horário selecionado; troca suave entre passos após ação; progresso sincronizado com estado; confirmação com um único movimento discreto. Aplicar à experiência real e ao Preview reutilizando componentes.
- Invariante: confirmação de pagamento só anima após estado confirmado do servidor; Preview continua identificado como simulação. Não simular recebimento para apresentar animação.
- Pronto: seleção/voltar/avançar preservam dados e foco; nenhum pedido duplicado; claro/escuro e movimento reduzido funcionam; provas mobile/desktop e checks obrigatórios passam.

## A2 — T2 CODEXADO: painel

- Arquivos iniciais: agenda-dashboard/components/dashboard/shell.tsx, forms.tsx, booking-status.tsx, pix-key-form.tsx; páginas correspondentes apenas se o estado for controlado ali.
- Dependências: tokens A1 e disponibilidade do painel. Corrigir bloqueio operacional existente antes de polish.
- Implementação: abertura/fechamento do menu mobile, feedback de ações principais, estado de salvando e resultado após resposta real; atualização de status discreta sem mover toda a agenda.
- Invariante: nenhum sucesso antes de persistência; animação não expõe chave Pix; não tocar auth/backend. Não remontar agenda nem perder posição de rolagem.
- Pronto: teclado/toque funcionam durante e depois do movimento; dados e foco preservados; nenhuma mudança de layout ou regressão de login; mobile/desktop e checks passam.

## A3 — T5 Trilha: landing e onboarding

- Arquivos iniciais: agenda-conversion/components/onboarding/OnboardingFlow.tsx e StepAccount.tsx; components/landing/LandingHeader.tsx; seção hero existente identificada por busca focada.
- Dependência: tokens A1. T5 possui landing/onboarding; T4 não edita cópias desses arquivos simultaneamente.
- Implementação: uma única sequência curta no hero, sem esconder conteúdo principal antes de JavaScript; feedback de toque nos CTA; troca de passo/progresso do onboarding e mensagens de erro/sucesso após ação.
- Invariante: erros permanecem legíveis; animação não anuncia email enviado nem negócio criado sem resposta real; não mudar preços/copy comercial por suposição.
- Pronto: hero aparece imediatamente mesmo sem movimento; CTA sem corte em 320/375px; onboarding preserva dados e foco; checks e provas passam.

## A4 — T6 Prisma: revisão visual

Após commits A1/A2/A3: revisar somente delta nas rotas reais, em 375px e desktop, claro/escuro e movimento reduzido. Conferir consistência, excesso de movimento, toque, foco e estabilidade. Registrar URL, viewport, commit/worktree servido e captura; sequência de frames ou observação no navegador para avaliar movimento. Screenshot estático não comprova qualidade da animação. Não editar produto.

## A5 — T3 CODEFICADO: regressão

Após entregas: verificar booking/onboarding com volta entre passos, preenchimento preservado, teclado, nenhuma duplicidade e estados corretos; testar prefers-reduced-motion e ausência de overflow. Reutilizar suíte existente; evitar testes frágeis de duração exata ou sleeps fixos. Anexar resultados reais.

## Integração e entrega

Maestri encaminha contratos/tokens e commits ao Tech Lead quando movimento alterar montagem, foco, solicitações ou compartilhamento entre módulos. Revisão classifica OK/MELHORAR/BLOQUEIA. Não criar revisão arquitetural extensa para simples transition de botão.

Ordem: A1 especifica tokens; A2/A3 implementam em paralelo após acordo; A4/A5 validam commits; autores corrigem bloqueios. Cada entrega inclui commit, arquivos, rotas, prova com movimento reduzido, checks e pendências. Nenhum merge/push nesta rodada.
