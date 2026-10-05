# Design Tokens e Direção Visual v2

> Documento normativo de design system para toda a interface pública de agendamento (Booking), telas de Onboarding/Landing e Painel do Dono.
> Status: **V2 HOMOLOGADA (T4)**  
> Referência de Design: Editorial Mineral & Placa de Valor (`ref_whale_loans.png`).  
> Autorização de Exceção ao AGENTS.md §6: Aceita pelo humano via Maestri.

---

## 1. Exceção Mitigada ao AGENTS.md Seção 6

O AGENTS.md §6 recomenda evitar "preto + verde ácido como padrão automático".  
**Mitigação arquitetural obrigatória aceita e registrada**:
- O verde-lima (`--lime` / `#C0F739`) **nunca** é utilizado como fundo expansivo ou preenchimento de botões de ação.
- O verde-lima atua estritamente como ponto de estado ativo (live dot), chip fino de status e detalhe métrico de alta precisão.
- O botão primário é rigorosamente uma **pílula preta** (`--ink` / `#0B0B0C`) com texto claro (`#F6F5F2`), ou pílula clara no modo escuro.
- O elemento memorável é a **Placa de Valor** (`--slab`), gerando sofisticação sem poluição visual.

---

## 2. Paleta de Cores Definitiva (6 Cores Fundamentais)

| Nome do Token | Hex Claro | Hex Escuro (`.dark`) | Função / Aplicação | Contraste Calculado |
|---|---|---|---|---|
| `--paper` | `#F6F5F2` | `#0F0F10` | Fundo principal da página (canvas mineral) | Base |
| `--surface` | `#FFFFFF` | `#19191B` | Superfície de cartões, listas e molduras | Estrutural |
| `--ink` | `#0B0B0C` | `#F6F5F2` | Texto principal, botões primários e placas | ≈ 18:1 vs paper (AAA) |
| `--muted` | `#5B5B5F` | `#A3A3A8` | Rótulos secundários, durações e apoio | ≈ 6:1 vs paper (AA) |
| `--line` | `#DEDCD6` | `#2C2C2F` | Divisores, contornos e linhas sutis | Estrutural |
| `--lime` | `#C0F739` | `#C0F739` | Ponto de estado (dot), chip fino, realce | 15:1 vs slab |

### 2.1 Placa de Valor e Estados
- **`--slab`**: Fundo `#0B0B0C` (claro) e `#000000` (escuro), borda `--line`, texto `--slab-foreground` (`#FFFFFF`).
- **`--danger`**: `#B3261E` (claro) e `#FF8A80` (escuro).
- **`--ring`**: Foco com anel de 2px `--ink` com offset no tema claro; anel `--lime` no tema escuro.
- **Regra de Acessibilidade**: O verde-lima sobre `--paper` possui contraste de 1,2:1, sendo **estritamente proibido** para textos soltos, ícones desacompanhados ou bordas de foco no modo claro.

---

## 3. Tipografia

Duas famílias via `next/font/google`:
1. **Títulos, Cabeçalhos e Números da Placa (`--font-display`)**: `Plus Jakarta Sans` (geométrica, precisa, robusta).
2. **Corpo, Dados e Horários (`--font-sans`)**: `Inter` (numerais tabulares `tabular-nums` para moedas e horários).

### 3.1 Escala Tipográfica (14 / 16 / 20 / 28 / 40 / 64 px)

| Tamanho | Leading | Token | Aplicação |
|---|---|---|---|
| **64px** | 1.05 | `text-6xl` | Número central da Placa de Valor (`font-display font-extrabold tabular-nums`) |
| **40px** | 1.15 | `text-4xl` | Placa de valor em mobile compacto (< 375px) e títulos da landing |
| **28px** | 1.25 | `text-2xl` | Nome do estabelecimento / cabeçalhos principais |
| **20px** | 1.4 | `text-xl` | Títulos de passos e diálogos |
| **16px** | 1.5 | `text-base` | Formulários e botões principais (evita zoom iOS) |
| **14px** | 1.45 | `text-sm` | Grade de horários e legendas de procedimentos |

---

## 4. Escala Estrutural: Raios e Espaçamentos

### 4.1 Raios de Borda (Border Radius)
- **Moldura Externa (`--radius-frame`)**: 32px (`rounded-3xl` / 32px).
- **Cartões e Seções (`--radius-card`)**: 14px (`rounded-2xl` / 14px).
- **Inputs e Campos (`--radius-field`)**: 12px (`rounded-xl` / 12px).
- **Botões e Chips**: Formato Pílula (`rounded-full`).

### 4.2 Espaçamentos (Mobile-First)
Grid padronizado: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`.  
Padding lateral obrigatório no mobile: `16px` (`px-4`).  
Alvo de toque mínimo: `44px x 44px` (`min-h-11`).

---

## 5. Elemento-Assinatura Memorável: A Placa de Valor (`ValueSlab`)

Um cartão escuro mineral imponente (`bg-slab text-slab-foreground`), moldado com raio de 24–32px e borda fina, exibindo em tipografia gigante (`64px` com fallback responsivo para `40px`) o valor exato a ser pago ou recebido.

- **No Booking**: Apresenta com impacto transparente o valor do sinal no Pix no Passo 4 (e resumo destacado no Passo 3).
- **No Painel (T2)**: Destaca o total de sinais confirmados no dia e o faturamento garantido.
- **Na Landing (T5)**: Destaca a precificação dos planos mensais (R$ 49 / R$ 79).

### 5.1 Implementação única

`components/ui/value-slab.tsx` é a única implementação (antes havia uma em `feat/booking-ui` e outra em `feat/conversion`):

- `label`, `value`: obrigatórios.
- `unit`: unidade ao lado do valor (ex.: `/ mês`), usada na landing.
- `sublabel`: texto de apoio abaixo do valor.
- `badge`: texto simples vira um `StatusChip` ativo; um nó React é renderizado como está.
- Demais atributos HTML (`aria-*`, `className`...) são repassados ao contêiner.

Estados de erro usam `text-destructive`/`border-destructive`, mapeados para `--danger` em `app/globals.css`.
