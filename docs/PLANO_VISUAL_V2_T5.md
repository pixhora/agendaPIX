# Mapeamento de Componentes e Migração de Tokens v2 (T5)

Data: 2026-10-04
Referência: `BRIEF_VISUAL_V2.md`
Responsável: T5 — Product/Conversion Designer (`agenda-conversion`)

## 1. Princípios da Refatoração Visual v2

1. **Assinatura Única: Placa de Valor (`--slab`)**:
   - Fundo escuro mineral (`#0B0B0C` claro, `#000000` escuro).
   - Borda fina `--line` (`#DEDCD6` / `#2C2C2F`).
   - Número em destaque tipográfico: 64px (40px abaixo de 375px), `font-variant-numeric: tabular-nums`, texto `#FFFFFF`.
   - Na Landing: aplicada no Hero como demonstração visual e no Pricing nos planos R$ 49 e R$ 79.
   - No Onboarding: aplicada no resumo de valor e sinal garantido (StepService e StepAccount).
2. **Mitigação do Lima (autorizada pelo humano)**:
   - Lima (`#C0F739`) NUNCA é usado como fundo grande nem botão.
   - Usado exclusivamente como: ponto indicador de estado (bullet ativo), chip fino, badge discreto.
   - Botão primário: pílula preta (`bg-ink text-paper` / `rounded-full`).
   - Proibido texto lima sobre fundo claro (`#F6F5F2` paper, contraste 1.2:1).
3. **Disciplina Editorial e Anti-clichês**:
   - Uma única sequência de entrada no Hero; sem animações de fade-up por seção.
   - Títulos em sentence case (sem CAIXA ALTA espaçada decorativa).
   - Botões com rótulo direto da ação em pt-BR (sem setinhas `->` universais).
   - Linhas de texto com até 70 caracteres.

---

## 2. Inventário de Componentes a Migrar

| Componente | Função | Mudança v2 |
|---|---|---|
| `components/landing/LandingHeader.tsx` | Cabeçalho & CTA | Logo com chip discreto; botão "Começar grátis" pílula preta. |
| `components/landing/LandingHero.tsx` | Hero & Proposta de Valor | 1 sequência de entrada; CTA pílula preta; sem badges verde neon. |
| `components/landing/LandingHeroVisual.tsx` | Composição visual | Cartão central reformulado como **Placa de Valor (`--slab`)** exibindo sinal Pix garantido R$ 30,00 tabular-nums 64px. |
| `components/landing/LandingTrustBand.tsx` | Segmentos atendidos | Fundo paper/surface; chips neutros com tipografia limpa. |
| `components/landing/LandingEditorialBenefits.tsx` | Vantagens | Cartões neutros sem fundos coloridos gigantes; ícones e chips de acento fino. |
| `components/landing/LandingHighlightBanner.tsx` | 3 passos | Fundo neutro/surface com moldura 32px; placa escura interna com números limpos. |
| `components/landing/LandingInteractiveDemo.tsx` | Demo 4 passos | Miniatura com botão e slots seguindo tokens v2. |
| `components/landing/LandingPainSolution.tsx` | Comparativo dor/solução | Lado da solução com borda estrutural fina e bullets lima discretos. |
| `components/landing/LandingPricing.tsx` | Preços R$ 49 / R$ 79 | **Placa de Valor (`--slab`)** em cada plano: número 64px branco, tabular-nums. Botão pílula preta. |
| `components/landing/LandingFaq.tsx` | Dúvidas frequentes | Cartões surface neutros, borda line. |
| `components/landing/LandingFooter.tsx` | Rodapé | Fundo dark/surface com tipografia discreta. |
| `components/onboarding/OnboardingFlow.tsx` | Shell do Onboarding | Stepper com pílulas pretas ativas, linha line, sem verde neon. |
| `components/onboarding/StepBusiness.tsx` | Passo 1: Negócio | Input raio 12px, botão pílula preta. |
| `components/onboarding/StepService.tsx` | Passo 2: Serviço | Resumo com valor/sinal em placa elegante, botões pílula. |
| `components/onboarding/StepHours.tsx` | Passo 3: Horários | Dias da semana com seleção preta contrastante (`bg-ink text-paper`). |
| `components/onboarding/StepAccount.tsx` | Passo 4: Conta | Cartão de resumo com contraste WCAG AAA e botão de ativação pílula preta. |
| `components/auth/LoginForm.tsx` | Formulário de Login | Botão pílula preta, foco anel ink com offset. |

---

## 3. Mapeamento de Tokens: v1 → v2

| Padrão Antigo | Novo Padrão v2 | Justificativa |
|---|---|---|
| `bg-primary` (era lima `#C0F739`) | `bg-ink text-paper` / `bg-primary text-primary-foreground` | Botão primário agora é pílula preta com texto claro. |
| `text-primary` sobre claro | `text-ink` ou `text-accent-forest` | Lima sobre paper viola contraste (1.2:1); texto deve ser legível. |
| `bg-accent-forest text-primary` | `bg-slab text-slab-foreground` com detalhe lima | Placa de valor com alto contraste. |
| `border-accent-forest` / `border-lime-300` | `border-line` (`#DEDCD6`) ou `border-slab` | Contornos estruturais neutros. |
| Ponto de status / bullet | `h-2 w-2 rounded-full bg-lime` (`#C0F739`) | Lima reservado exclusivamente para indicador de estado e chips. |
| Destaque numérico financeiro | `text-5xl sm:text-6xl font-black font-display tabular-nums text-slab-foreground` | Placa de valor como assinatura do micro-SaaS. |
