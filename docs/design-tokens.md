# Design tokens v2.1

> Fonte da verdade: `app/globals.css`. Decisões e motivos: `docs/DESIGN_DECISION.md` (§15 explica a troca da lima pelo verde-água do Pix).
> v2.1 substitui a v2 (lima `#C0F739` como acento). A lima foi aposentada; os aliases legados `accent-forest`, `lime`, `dark-card` e `pix-success` foram removidos.

## 1. Princípios

- Base neutra mineral (papel, superfície, tinta) e **um único acento**: o verde-água do Pix (`--pix`). Ele marca o que é dinheiro/Pix e estados ativos; nunca vira fundo de página.
- Botão primário: pílula `--ink` (preta no claro, clara no escuro). Botão `pix` só para ações de Pix (gerar/copiar/salvar chave).
- **`--muted` é cor de texto.** Fundos sutis usam `--subtle` (corrige a pendência 7: `bg-muted` era usado como fundo).
- Status nunca depende só de cor: `StatusBadge` = ícone + texto + cor (WCAG 1.4.1).
- Elemento-assinatura: **Placa de Valor** (`ValueSlab`, fundo `--slab`) para números de dinheiro.

## 2. Cores

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--paper` | `#F6F5F2` | `#0F0F10` | Fundo da página |
| `--surface` | `#FFFFFF` | `#19191B` | Cartões, listas, campos |
| `--subtle` | `#EFEEEA` | `#222225` | Fundos sutis: skeleton, prefixo de campo, cabeçalho de tabela, hover |
| `--ink` / `--ink-hover` | `#0B0B0C` / `#26262A` | `#F6F5F2` / `#E2E1DD` | Texto principal e botão primário |
| `--muted` | `#5B5B5F` | `#A3A3A8` | Texto secundário (só texto) |
| `--line` / `--line-strong` | `#DEDCD6` / `#8D8C88` | `#2C2C2F` / `#6B6B70` | Divisores / borda de campo (3:1 contra a superfície) |
| `--slab` / `--slab-foreground` / `--slab-muted` | `#0B0B0C` / `#FFF` / `#C9C9CC` | `#000` / `#FFF` / `#B8B8BD` | Placa de Valor e faixas escuras |
| `--pix` / `--pix-hover` / `--pix-foreground` | `#0B7A6E` / `#096A60` / `#FFF` | `#3FD0BE` / `#5FDCCC` / `#0B0B0C` | Acento único: Pix, dinheiro, estado ativo |
| `--pix-soft` | `#E8F6F3` | `#10302C` | Fundo de destaque Pix (aviso, próximo atendimento) |
| `--pix-bright` | `#3FD0BE` | `#3FD0BE` | Ponto "ao vivo" sobre a placa escura |
| `--success` / `--success-soft` | `#156B3A` / `#E6F4EA` | `#6FD49A` / `#133222` | Confirmado, salvo |
| `--warning` / `--warning-soft` | `#8A5300` / `#FDF1DC` | `#F2B25A` / `#33250F` | Aguardando sinal, avisos |
| `--danger` / `--danger-soft` | `#B3261E` / `#FBE9E7` | `#FF8A80` / `#3A1714` | Erros e ações destrutivas |
| `--ring` | `#0B0B0C` | `#3FD0BE` | Anel de foco (2px + offset) |

Aliases shadcn mantidos para compatibilidade: `background`, `foreground`, `primary`, `primary-foreground`, `muted-foreground`, `border`, `destructive`.

### 2.1 Contraste (WCAG 2.2, calculado)

| Par | Claro | Escuro |
|---|---|---|
| `ink` sobre `paper` | 18,1:1 | 17,6:1 |
| `muted` sobre `paper` / `surface` / `subtle` | 6,2 / 6,8 / 5,8:1 | 7,6 / 7,0 / 6,3:1 |
| `pix` sobre `paper` / `surface` / `pix-soft` | 4,8 / 5,2 / 4,7:1 | 10,0 / 9,2 / 7,4:1 |
| `pix-foreground` sobre `pix` (botão Pix) | 5,2:1 | 10,3:1 |
| `success` / `warning` / `danger` sobre o `-soft` | 5,8 / 5,7 / 5,6:1 | 7,7 / 8,0 / 7,0:1 |
| `slab-muted` sobre `slab` | 11,9:1 | — |
| `line-strong` sobre `surface` (borda de campo, 1.4.11) | 3,4:1 | 3,3:1 |

## 3. Tipografia

- Display: Plus Jakarta Sans (`font-display`), pesos 700–800, `tracking-tight` e `word-spacing: 0.06em` para compensar o espaço encolhido.
- Texto: Inter (`font-sans`). Valores e horários sempre com `tabular-nums` (utilitário `.tabular` disponível).
- Campos com 16px (sem zoom no iOS) e altura mínima de 48px; botões com 44px (`min-h-11`), `lg` com 48px.

## 4. Forma, sombra e movimento

| Token | Valor | Uso |
|---|---|---|
| `--radius-frame` | 28px | Molduras grandes, placa, folhas laterais |
| `--radius-card` | 16px | Cartões e listas |
| `--radius-field` | 12px | Campos, itens de menu |
| `--shadow-card` | sutil | Cartões e botões preenchidos |
| `--shadow-raised` | elevada | Popover, painel lateral, prints da landing |
| `--duration-feedback` / `--duration-opening` / `--duration-step` | 120 / 180 / 240ms | Hover/press, abertura, troca de etapa |
| `--ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` | Todas as transições |

Classes utilitárias: `.transition-feedback`, `.transition-opening`, `.transition-step`, `.animate-step-in`, `.animate-confirm-pop`, `.bg-dots`. Todas respeitam `prefers-reduced-motion`.

## 5. Tema escuro

- Classe `.dark` (ou `.light`) no `<html>`, aplicada por um script inline no `<head>` (`lib/theme.ts`) **antes da primeira pintura**: sem flash (pendência 5).
- Preferência em `localStorage` (`agenda-theme`: `light` | `dark`; ausente = sistema). Alternador `ThemeToggle` (radiogroup claro/escuro/sistema) no cabeçalho da landing, no rodapé do login, na sidebar e em Configurações do painel, e na página pública.
- Sem JavaScript, `:root:not(.light):not(.dark)` segue `prefers-color-scheme`.

## 6. Componentes base (`components/ui`)

`Button` (default, pix, outline, ghost, danger; tamanhos default/lg/sm/icon; `buttonVariants` com tailwind-merge), `Input`, `Select`, `Label`, `FieldHint`, `FieldError`, `Card`, `Skeleton` (sobre `--subtle`), `StatusBadge`, `ValueSlab` e `StatusChip`, `BrandMark`/`BrandLink`, `Calendar` (react-day-picker 9, pt-BR), `Popover` (Radix), `Switch` (checkbox nativo), `Toaster` (Sonner). Ícones: lucide-react, sempre `aria-hidden` quando decorativos.
