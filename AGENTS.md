# AGENTS.md

> Leia este arquivo inteiro antes de qualquer tarefa. Ele vale para todos os agentes (builder, reviewer, qualquer outro).
> Idioma: responda e comente em português (BR). Código, nomes de variáveis e commits em inglês.

## 1. Missão

Construir um micro-SaaS que **cobra dinheiro de verdade o mais rápido possível**, mesmo que pouco no início.
Prioridade absoluta: **primeiro cliente pagante**, depois todo o resto.

- Produto inicial (EDITAR se mudar o nicho): **agenda online + cobrança por Pix para prestadores de serviço** (salões, barbearias, personal trainers, clínicas pequenas, manicures).
- Cliente-alvo: dono de negócio pequeno no Brasil, usa celular, vive no WhatsApp, não é técnico.
- Promessa em uma frase: "Seu cliente agenda sozinho, paga o sinal por Pix e você para de perder horário."
- Modelo de receita: assinatura mensal (R$ 49 plano base, R$ 79 plano completo) + opcionalmente taxa pequena por cobrança. Valores aprovados: 4900/7900 centavos; fonte: `/var/home/matheus/projetos/agenda-backend/docs/PRECOS.md`.

### Regra do escopo
Se uma tarefa não ajuda a **(a) atrair, (b) converter ou (c) reter** um cliente pagante, ela não é prioridade. Não construa features "legais" antes do primeiro pagamento.

## 2. Stack (somente open source, exceto gateway de pagamento)

| Camada | Escolha |
|---|---|
| Framework | Next.js (App Router) + TypeScript estrito |
| UI | Tailwind CSS + shadcn/ui (Radix) + Motion (animações) |
| Banco | PostgreSQL (SQLite local em dev se simplificar) |
| ORM | Drizzle ORM + migrations versionadas |
| Auth | Better Auth (email + link mágico; Google opcional) |
| Validação | Zod em toda borda (API, formulários, webhooks) |
| Testes | Vitest (unidade) + Playwright (fluxos críticos) |
| Deploy | Docker + Coolify num VPS, Caddy/Traefik com HTTPS |
| Pagamento | Pix via Asaas (ou Mercado Pago) atrás de uma interface `PaymentProvider` |
| Email | Resend ou SMTP próprio; templates em React Email |
| Analytics | Umami ou Plausible (self-hosted) |

Regras de dependência: não adicionar biblioteca nova sem justificar em uma linha no PR. Prefira o que já está na tabela.

## 3. Estrutura de pastas

```
/app            rotas (marketing, painel, página pública de agendamento)
/components     UI reutilizável (ui/ = shadcn)
/lib            regras de negócio, helpers puros, clientes externos
/lib/payments   PaymentProvider + implementação do gateway
/db             schema Drizzle, migrations, seeds
/tests          unitários e e2e
/docs           CONTRATOS.md, pedidos.md, backlog.md, design-tokens.md
```

Regras de negócio ficam em `/lib`, nunca dentro de componentes.

## 4. Comandos

```bash
pnpm install
pnpm dev          # desenvolvimento
pnpm lint         # deve passar sem warnings
pnpm typecheck    # deve passar
pnpm test         # unitários
pnpm test:e2e     # Playwright (fluxo de agendar + pagar)
pnpm db:migrate   # aplica migrations
pnpm build        # build de produção
```

Antes de dizer que terminou: rode `lint`, `typecheck` e `test`. Se algum falhar, corrija. Nunca entregue "deve funcionar".

## 5. Terminais e papéis (Maestri)

Há 6 agentes em paralelo: 3 Codex e 3 Antigravity CLI (`agy`). **Descubra qual é o seu terminal pela primeira mensagem que receber** ("Você é o terminal X"). Se não souber, pergunte.

| # | Agente | Papel | Branch / pasta |
|---|---|---|---|
| 1 | Codex | Backend, banco, Pix e webhooks | `feat/backend` / `agenda-backend` |
| 2 | Codex | Painel do dono (agenda, clientes, serviços) | `feat/dashboard` / `agenda-dashboard` |
| 3 | Codex | Testes e2e e QA do trabalho dos agy 4 e 5 | `feat/tests` / `agenda-tests` |
| 4 | agy | Página pública de agendamento e design system | `feat/booking-ui` / `agenda-booking-ui` |
| 5 | agy | Landing de vendas e onboarding | `feat/landing` / `agenda-landing` |
| 6 | agy | Revisor de código e segurança do trabalho dos Codex 1 e 2 | `feat/review` / `agenda-review` |
| - | Humano (eu) | Decide produto, preço e prioridade | - |

### Regras de convivência (obrigatórias)

- **Só mexa no seu branch e na sua pasta (git worktree).** Nunca edite os arquivos de outro terminal nem faça checkout no branch dele.
- **Só escreva em áreas do seu papel.** Backend não mexe em componentes visuais; interface não mexe em regras de pagamento. Se precisar de uma mudança fora da sua área, escreva o pedido em `/docs/pedidos.md` (de quem, para quem, o quê) e siga com outra coisa.
- **Contratos primeiro.** Formato de API, tabelas e eventos ficam em `/docs/CONTRATOS.md`. Quem quiser mudar um contrato atualiza o arquivo no mesmo commit e avisa em `/docs/pedidos.md`. Backend e interface leem o mesmo arquivo.
- **Esqueleto primeiro.** Enquanto o esqueleto do projeto não estiver no `main`, **só o terminal 1 escreve código**. Os demais aguardam, leem o AGENTS.md e preparam planos.
- **Atualize antes de começar:** `git fetch && git rebase main`. Commits pequenos, mensagem em inglês no formato `feat: ...`, `fix: ...`, `test: ...`.
- **Merge só no `main` com aprovação:** a mudança precisa de **ok** do revisor designado e de `lint`, `typecheck` e `test` passando. Quem faz o merge é o humano.

### Revisão cruzada (modelos diferentes se revisam)

- Terminal 6 (agy) revisa os terminais 1 e 2 (Codex): bugs, segurança, dinheiro em centavos, isolamento entre clientes, estados de erro esquecidos.
- Terminal 3 (Codex) testa os terminais 4 e 5 (agy): fluxos reais com Playwright, mobile 375px, acessibilidade e regressão visual.
- Resultado da revisão: lista objetiva com **bloqueia** / **melhorar** / **ok**, com arquivo e linha. Revisor não reescreve o código do outro; aponta e quem fez corrige.

### Como trabalhar cada tarefa

1. Escreva o plano em 3 a 5 linhas antes de mexer em código.
2. Implemente no seu branch, rodando `lint`, `typecheck` e `test` ao longo do caminho.
3. Ao terminar, escreva: o que mudou, como testar e o que ficou pendente.
4. Peça a revisão ao terminal designado e corrija o que ele marcar como **bloqueia**.

### Limite de cota

Agentes demais ao mesmo tempo gastam cota rápido. Se você receber erro de limite de uso, pare, anote o ponto em que parou em `/docs/pedidos.md` e aguarde. Não tente contornar.

## 6. Interface: tem que ser FODA

A interface é o diferencial de venda. Dono de salão decide em segundos se o produto parece sério. Mas "foda" aqui significa **distinto e rápido de usar**, não cheio de efeito.

### Direção visual (definir uma vez, seguir sempre)
Antes de construir qualquer tela, criar `/docs/design-tokens.md` e depois `app/globals.css` com tokens:
- **Cor:** 4 a 6 cores nomeadas com hex. Uma cor de destaque forte, usada com disciplina (ex.: só em ações principais e estados importantes). Contraste AA no mínimo.
- **Tipografia:** no máximo 2 famílias (Google Fonts via `next/font`), claramente diferentes entre si. Escala tipográfica definida (ex.: 14/16/20/28/40/64). Linhas de texto com menos de 80 caracteres.
- **Raio, sombra e espaçamento:** escalas fixas. Raios diferentes conforme a hierarquia (botão, card, modal), não um único raio para tudo.
- **Uma coisa memorável:** escolha UM elemento de assinatura (ex.: o calendário/agenda com um visual próprio, uma animação de confirmação do Pix, uma tipografia ousada no hero). O resto fica quieto e disciplinado.

### Evitar (cara de template gerado por IA)
- Fundo creme + serifada + terracota, ou preto + verde ácido, como padrão automático.
- Tudo em cards iguais, mesma sombra cinza, mesmo raio, gradiente decorativo.
- Rótulos em CAIXA ALTA espaçada acima de todo título, números "01 / 02 / 03" quando o conteúdo não é uma sequência, setinha → em todo botão.
- Destacar uma palavra só do título em itálico ou cor.
- Animação de fade-up em toda seção e hover em todo card.

### Obrigatório
- **Mobile-first.** O dono do negócio e o cliente final usam celular. Testar em 375px primeiro.
- **Rápido:** nenhuma ação principal deve levar mais de 3 toques. Agendamento em até 4 passos.
- **Estados completos em toda tela:** carregando (skeleton), vazio (convida a agir), erro (diz o que houve e como resolver, sem pedir desculpa vaga) e sucesso.
- **Movimento com propósito:** animar só respostas a ações (abrir, confirmar, pagar). No máximo uma sequência de entrada na página inicial. Respeitar `prefers-reduced-motion`.
- **Acessibilidade:** foco de teclado visível, labels em todos os campos, contraste, alvos de toque de pelo menos 44px.
- **Modo escuro** com tokens próprios, não só inverter cores.

### Texto da interface
- Português do Brasil, simples, frases em caixa normal (sentence case), voz ativa.
- Botões dizem o que acontece: "Confirmar horário", "Pagar sinal por Pix", não "Enviar".
- O mesmo nome para a mesma ação em todo o fluxo (botão "Publicar" gera aviso "Publicado").
- Fale a língua do dono do negócio: "horários", "clientes", "sinal". Nunca "webhook", "slot", "payload".

## 7. Fluxos críticos (ordem de construção)

1. **Página pública de agendamento** (`/[slug]`): escolhe serviço → escolhe horário → dados do cliente → paga sinal por Pix → confirmação.
2. **Painel do dono:** agenda do dia/semana, lista de clientes, serviços e preços, horários de funcionamento.
3. **Cobrança Pix:** QR Code + copia-e-cola, webhook confirma pagamento e libera o horário. Idempotente.
4. **Lembretes:** link de WhatsApp pré-preenchido (`wa.me`) primeiro; API oficial só depois de ter clientes pagando.
5. **Assinatura do próprio SaaS:** trial de 7 dias sem cartão, depois cobrança mensal por Pix/cartão.
6. **Landing page de vendas** com demo real do produto, preço claro e botão de começar.

Não pule a ordem. Os itens 1 a 3 são o MVP.

## 8. Segurança e dinheiro (não negociável)

- Nunca commitar segredos. Usar `.env` e `.env.example` com chaves fictícias.
- Webhooks de pagamento: validar assinatura/token, ser **idempotentes**, registrar log de cada evento.
- Valores em **centavos (inteiros)**, nunca float.
- Autorização por tenant em toda query: um dono jamais enxerga dados de outro. Teste isso explicitamente.
- Validar todo input com Zod no servidor, mesmo que o cliente já valide.
- LGPD: coletar o mínimo de dados, ter política de privacidade e permitir exclusão da conta.
- Isolar o gateway atrás de `PaymentProvider` para poder trocar de fornecedor.

## 9. Qualidade e definição de pronto

Uma tarefa só está pronta quando:
- [ ] Funciona no mobile (375px) e no desktop
- [ ] Tem estados de carregando, vazio, erro e sucesso
- [ ] `lint`, `typecheck` e `test` passam
- [ ] Fluxos de dinheiro têm teste automatizado
- [ ] Sem segredo, sem `console.log` esquecido, sem TODO sem dono
- [ ] Reviewer deu **ok**
- [ ] Texto da interface revisado (claro, sem jargão)

## 10. Marcos de renda (guia de prioridade)

1. **Semana 1-2:** MVP (fluxos 1 a 3) no ar com domínio e HTTPS.
2. **Semana 2-3:** conversar com 5 donos de negócio reais, colocar 2 a 3 para usar de graça em troca de feedback.
3. **Semana 3-4:** ligar a cobrança da assinatura, converter os primeiros pagantes.
4. **Depois:** só então lembretes por API, relatórios, múltiplos profissionais, app instalável (PWA).

Em dúvida entre construir mais uma feature ou falar com um cliente, **fale com o cliente**.

## 11. Como se comportar

- Mudanças pequenas e verificáveis. Não refatore o que não foi pedido.
- Se encontrar um problema fora do escopo, anote em `/docs/backlog.md` em vez de corrigir sem avisar.
- Não invente requisitos de negócio, preços ou textos legais. Pergunte.
- Se algo estiver ambíguo, escolha a opção mais simples e registre a suposição no final da resposta.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ajuste de terminais (vale mais que a tabela da seção 5)

Por enquanto só existem os terminais 1, 2, 3 e 4. O revisor será o terminal 5 (Codex) e ainda não está ligado. O terminal 6 não existe.
Não peça revisão pelo Maestri a terminal que não está conectado. Ao terminar uma tarefa, apenas me avise com um resumo curto.
