# Design Tokens e Direção Visual (Definitivo)

> Documento normativo de design system para toda a interface pública de agendamento (Booking), telas de Onboarding/Landing e Painel do Dono.
> Status: **FINAL / HOMOLOGADO (T4)**
> Foco: mobile-first (375px), velocidade operacional, contraste alto (WCAG AA/AAA) e conversão imediata de agendamentos com Pix.

---

## 1. Identidade e Paleta de Cores (Verde-Lima & Floresta Mineral)

Uma direção visual editorial, limpa e funcional, que afasta qualquer cara de template genérico (sem fundo creme/terracota e sem fundo preto com verde neon).

### 1.1 Cores Nomeadas (6 Cores Principais)

| Token Semântico | Hex (Claro) | Hex (Escuro / `.dark`) | Função / Aplicação | WCAG Contraste Mínimo |
|---|---|---|---|---|
| `--color-background` | `#F5F6F2` | `#0E1612` | Fundo principal da página (canvas mineral) | Base |
| `--color-surface` | `#FFFFFF` | `#141F1A` | Superfície de cartões, formulários, modais | 1.05:1 vs canvas |
| `--color-foreground` | `#111613` | `#F5F6F2` | Texto principal, títulos e números tabulares | 16.5:1 vs surface (AAA) |
| `--color-muted-foreground` | `#5A645C` | `#8A968C` | Textos de apoio, durações, etiquetas secundárias | 4.8:1 vs surface (AA) |
| `--color-border` | `#E2E6DF` | `#23352C` | Divisores, contorno de inputs e cards desmarcados | Estrutural |
| `--color-primary` (Acento Lima) | `#C0F739` | `#C0F739` | Ação primária de conversão (botão pill com texto preto) | 13.8:1 vs texto `#111613` (AAA) |
| `--color-accent-forest` | `#0F3B2E` | `#175442` | Acento sólido para badges, estados selecionados e anéis | 9.2:1 vs branco (AAA) |
| `--color-dark-card` | `#0E1612` | `#080D0A` | Fundo de cards de destaque escuros | Alto contraste |

### 1.2 Regras de Aplicação
- **Modo Escuro**: ativado via seletor de classe `.dark` explícito no `<html>` (ou `@media (prefers-color-scheme: dark)` como fallback nativo do sistema).
- **Botões de Ação Principal**: fundo `--color-primary` (`#C0F739`), texto `--color-primary-foreground` (`#111613`), formato pill (`rounded-full`), nunca texto branco sobre verde-lima.
- **Estados de Foco**: anel de foco de 2px `--color-ring` com offset visível em todos os elementos interativos.

---

## 2. Tipografia

Duas famílias do Google Fonts carregadas via `next/font/google` com zero layout shift e zero dependência de download externo em tempo de execução:
1. **Títulos e Destaques (`--font-display`)**: `Plus Jakarta Sans` (geométrica, moderna, corte editorial contemporâneo).
2. **Corpo, Dados e Horários (`--font-sans`)**: `Inter` (alta legibilidade, numerais tabulares para horários e valores BRL).

### 2.1 Escala Tipográfica Padronizada

| Tamanho | Leading | Token / Classe | Peso Padrão | Aplicação Típica |
|---|---|---|---|---|
| **64px** | 1.1 | `text-6xl` | Bold (700) | Títulos heróicos na landing page |
| **40px** | 1.15 | `text-4xl` | Bold (700) | Cabeçalhos principais e destaques numéricos |
| **28px** | 1.25 | `text-2xl` | Bold (700) | Nome do estabelecimento / cabeçalho do fluxo |
| **20px** | 1.4 | `text-xl` | SemiBold (600) | Títulos de passos e modais |
| **16px** | 1.5 | `text-base` | Regular / Medium | Inputs de formulário (≥16px previne zoom no iOS) |
| **14px** | 1.45 | `text-sm` | Medium (500) | Grade de horários, durações de procedimentos |

*Comprimento máximo de linha de leitura: 65 a 80 caracteres (`max-w-prose`).*

---

## 3. Escala Estrutural: Raios, Sombras e Espaçamentos

### 3.1 Raio de Borda (Border Radius)
Hierarquia por escala física do elemento:
- **`radius-sm` (6px / `0.375rem`)**: badges informativos, tags de duração.
- **`radius` (10px / `0.625rem`)**: botões de horário (slots), campos de texto (inputs).
- **`radius-lg` (16px / `1rem`)**: cards de procedimentos, container do QR Code Pix.
- **`radius-xl` (24px / `1.5rem`)**: gavetas modais inferiores (bottom sheets).
- **`radius-pill` (9999px / `rounded-full`)**: botões de conversão e badges de status.

### 3.2 Sombras (Elevation)
- `shadow-xs`: `0 1px 2px 0 rgb(15 23 42 / 0.05)` (cards e inputs em repouso).
- `shadow-sm`: `0 2px 8px -1px rgb(15 23 42 / 0.08)` (card ativo / selecionado).
- `shadow-sheet`: `0 -8px 24px 0 rgb(15 23 42 / 0.10)` (barra inferior de confirmação).

### 3.3 Espaçamentos (Mobile-First 375px)
- **Gutter Lateral Obrigatório**: 16px (`px-4`) no mobile, 24px (`px-6`) em telas maiores.
- **Alvo de Toque Mínimo**: 44px x 44px (`min-h-11`) para qualquer botão ou controle tocável.
- **Reserva de Espaço Inferior**: `pb-24` ou `pb-28` em fluxos com barra flutuante para evitar sobreposição de conteúdo.

---

## 4. Elemento-Assinatura Memorável

**A Régua Tátil de Dias com Indicador Imediato de Vagas:**
- Fita horizontal com pílulas compactas no topo da seleção de horário.
- Exibe o dia da semana, dia do mês e a quantidade de vagas disponíveis sem exigir múltiplos toques.
- Navegação por toque com rolagem horizontal suave, sem barra de rolagem nativa aparente (`scrollbar-hide` compatível com claro e escuro).
- Foco de teclado acessível com suporte a setas e leitor de tela.

---

## 5. Tokens de Movimento e Acessibilidade

| Token | Duração | Função |
|---|---|---|
| `--duration-feedback` | `120ms` | Toque, seleção de radio, hover em botões |
| `--duration-opening` | `180ms` | Fades de rolagem, modais |
| `--duration-step` | `240ms` | Transição de passos de formulário |
| `--ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` | Curva de desaceleração suave |

### Suporte a `prefers-reduced-motion`
Quando ativo no sistema operacional do usuário, todas as animações e transições são imediatamente anuladas (`0s !important`), preservando usabilidade instantânea.
