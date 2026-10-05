# PLANO DE TELAS — design system e frontend "foda"

Hermes (Operação/Performance) — 2026-10-04. Plano/handoff para T4 (dono do visual), T5 e T6.
Não é implementação: nada de código de frontend foi escrito aqui.

## 1. Diagnóstico honesto do visual atual

Evidência real (`agenda-backend/docs/design-tokens.md`, `app/globals.css`):

- Tipografia: `Arial, Helvetica, sans-serif` — fonte de sistema, sem identidade, uma família só.
- Cor: um único azul `#1D4ED8` como primária em claro, `#93C5FD` no escuro; sem cor secundária.
- `design-tokens.md` diz explicitamente: "Base técnica provisória... Não define a identidade final."
- Nenhum elemento-assinatura (a "coisa memorável" exigida pelo AGENTS.md §6) foi definido.
- `globals.css` não tem `.dark` próprio — usa `prefers-color-scheme`, ou seja, herda o SO.

Conclusão: o visual atual é exatamente a "cara de template" que o AGENTS.md §6 manda evitar
(fundo slate + um azul + raio único + Arial). Não é bug — o design system nunca foi construído.

## 2. O que "telas perfeitas" exige (não é ferramenta, é direção + prova)

1. Direção visual decidida UMA vez em `docs/design-tokens.md`: 4–6 cores nomeadas com hex, UMA cor
   de destaque usada com disciplina, 2 famílias tipográficas distintas (via `next/font`, sem download
   no build), escala 14/16/20/28/40/64, raios 6/12/16, sombra só em sobreposição.
2. UM elemento-assinatura: sugestão natural do produto = a régua de horários / o calendário do
   booking com visual próprio (o "seletor de horário" é a tela que o cliente final mais toca).
3. Modo escuro com tokens PRÓPRIOS (`.dark`), não inversão.
4. Mobile-first 375px → desktop; ≤3 toques para ação principal; booking em ≤4 passos.
5. Estados em toda tela: skeleton / vazio que convida / erro que explica / sucesso.
6. Prova em navegador real (screenshot 375 e 1280, claro e escuro), não em descrição.

## 3. MCPs e ferramentas disponíveis AGORA (verificado)

| Ferramenta | Tipo | Para quê |
|---|---|---|
| Context7 (`mcp__context7__resolve_library_id`, `query_docs`) | MCP ativo | Docs ATUAIS de Next 16 / Tailwind 4 / Radix / Base UI — evita API que mudou (o AGENTS avisa que este Next não é o dos dados de treino) |
| `agent-browser` (skill: agent-browser) | CLI Playwright | Abrir as telas, tirar screenshot 375/1280, medir tempo real, pegar erro de console |
| `computer_use` / cua-driver | desktop | Olhar no dispositivo/desktop quando o headless não basta |
| `dogfood` (skill) | QA exploratório | Caçar bug de tela com evidência antes de dizer "pronto" |
| skills `web-ui-visual-audit`, `web-ui-layout-audit` | auditoria | Achar desalinhamento/overflow com evidência |

Não há MCP de Figma conectado; a skill `figma` existe, mas importar Figma não é pré-requisito.

## 4. Skills que valem a pena (com o papel certo)

- `frontend-design` — regras para UI distinta e anti-genérica. Carregar ANTES de olhar tela.
- `design-doctrine` — layout surface-first com auditoria. Bom para a régua de horários.
- `popular-web-designs` — 54 design systems reais (Stripe/Linear/Vercel) como REFERÊNCIA de
  estrutura/escala, não para copiar cor.
- `design-md` — se quiserem especificar tokens como DESIGN.md validável.
- `omh-design-quality-gate` + `omh-visual-qa` — portão de qualidade e QA visual observável.
- `ui-localization` — conferir pt-BR sem jargão (AGENTS §6: "horários/clientes/sinal", nunca "slot/webhook/payload").
- `claude-design` — só para protótipo HTML descartável fora do app.

Regra: skill define COMO fazer; a decisão de identidade é do humano/T4. Nenhuma ferramenta
entrega "tela perfeita" sozinha — entrega referência e prova.

## 5. Plano de execução — T4 (dono)

1. Escrever `docs/design-tokens.md` FINAL: paleta nomeada hex, 2 fontes, escalas, raios, sombra,
   e o elemento-assinatura escolhido. (Uma decisão, seguida sempre.)
2. Reescrever `app/globals.css` com tokens em `:root` + `.dark` explícito; parar de depender só de
   `prefers-color-scheme`. Ligar `next/font` (sem download no build).
3. Aplicar nos componentes `ui/` (button/card/input) e propagar para booking, dashboard e landing.
4. Corrigir `agenda-booking-ui/components/booking/StepSlot.tsx:188` (barra nativa no escuro).
5. Provar com `agent-browser`: screenshot 375 e 1280, claro e escuro, com console sem erro.
6. Fechar com `lint`/`typecheck`/`test` verdes e revisor designado.

## 6. Plano — T5 (conversão) e T6 (auditoria)

- T5: usar os tokens de T4 (não criar design system paralelo); hero com UMA sequência de entrada;
  preço R$49/R$79 de `docs/PRECOS.md`; CTA que diz o que acontece ("Começar grátis", não "Enviar").
- T6: auditar cada tela entregue (arquivo:linha + viewport + screenshot), classificar
  `BLOQUEIA/MELHORAR/OK`; não reescrever o código dos autores.

## 7. Guard-rails anti-template (do AGENTS.md §6)
Evitar: creme+serifada+terracota; preto+verde ácido; tudo em card igual; rótulo em CAIXA ALTA
espaçada em todo título; "01/02/03" sem sequência real; setinha em todo botão; fade-up em toda
seção; hover em todo card. Respeitar `prefers-reduced-motion`. Alvos de toque ≥ 44px.
