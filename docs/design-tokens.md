# Design Tokens e Direção Visual

> Documento de referência visual para a interface pública de agendamento e design system.
> Foco: mobile-first (375px), velocidade operacional, contraste alto e conversão imediata de agendamentos com Pix.

---

## 1. Paleta de Cores (Direção Visual Verde-Lima & Editorial)

Inspirada na referência de design de alta conversão (`ee905469-4d39-45c2-a095-6af185533ae1.png`): fundo off-white mineral, títulos sans-serif pretos marcantes, acentos em verde-lima vibrante e verde-petróleo profundo.

| Nome do Token | Hex | Função / Aplicação | Contraste (WCAG) |
|---|---|---|---|
| `color-bg-canvas` | `#F5F6F2` | Fundo principal da aplicação (off-white mineral contemporâneo) | Base |
| `color-surface` | `#FFFFFF` | Superfície de cartões, formulários e painéis | 1.05:1 vs canvas |
| `color-dark-card` | `#0E1612` | Fundo de cards escuros de alta sofisticação e mockups | 15.5:1 vs canvas |
| `color-text-main` | `#111613` | Títulos editoriais, valores e textos principais (preto carvão) | 16.5:1 vs surface (AAA) |
| `color-text-muted` | `#5A645C` | Textos de apoio, durações, etiquetas secundárias (cinza neutro) | 4.8:1 vs surface (AA) |
| `color-border` | `#E2E6DF` | Divisores, contorno de inputs e cards desmarcados | Estrutural |
| `color-accent-lime` | `#C0F739` | **Ação primária de energia**: botões pill de conversão com texto preto | 13.8:1 vs texto `#111613` (AAA) |
| `color-accent-forest` | `#0F3B2E` | **Acento profundo de solidez**: badges de nicho, cards sobrepostos e títulos | 9.2:1 vs branco (AAA) |

### Formato de Botões e Badges
- Botões de conversão e badges de categoria utilizam estritamente o formato **Pill** (`rounded-full` / `radius-pill`).

---

## 2. Tipografia

Duas famílias do Google Fonts via `next/font`:
1. **Títulos e Ações**: `Plus Jakarta Sans` (geométrica, moderna, corte contemporâneo e excelente leitura em cabeçalhos compactos).
2. **Corpo, Dados e Horários**: `Inter` (numerais tabulares perfeitos para horários e valores em R$).

### Escala de Tipos

| Token | Tamanho / Altura de Linha | Peso | Uso |
|---|---|---|---|
| `type-2xl` | 28px / 36px | Bold (700) | Nome do estabelecimento no cabeçalho |
| `type-xl` | 20px / 28px | SemiBold (600) | Títulos das etapas do fluxo |
| `type-lg` | 18px / 26px | SemiBold (600) | Nome do serviço, valor em destaque |
| `type-base` | 16px / 24px | Regular (400) / Medium (500) | Inputs de formulário (evita zoom no Safari iOS) e botões |
| `type-sm` | 14px / 20px | Medium (500) | Grade de horários, durações (ex: "45 min") |
| `type-xs` | 12px / 16px | Regular (400) | Badges de status, avisos de sinal Pix |

*Regra rígida: linhas de texto de leitura nunca ultrapassam 65 caracteres.*

---

## 3. Escalas Estruturais

### Raio de Borda (Border Radius)
Hierarquia por tamanho de componente, evitando arredondamento uniforme e genérico:

- `radius-sm` (6px): Badges informativas, tags de duração.
- `radius-md` (10px): Botões de horários, campos de texto (inputs).
- `radius-lg` (16px): Cards de serviços, caixa do QR Code Pix.
- `radius-xl` (24px): Barra de ação inferior flutuante e gaveta modal (bottom sheet).

### Sombras (Elevation)
Sombras suaves e direcionadas, sem excesso de blur escuro:

- `shadow-sm`: `0 1px 2px 0 rgb(15 23 42 / 0.05)` (cards e inputs em repouso).
- `shadow-md`: `0 4px 12px -2px rgb(15 23 42 / 0.08)` (card selecionado, botão flutuante).
- `shadow-sheet`: `0 -8px 24px 0 rgb(15 23 42 / 0.10)` (barra inferior de confirmação).

### Espaçamento (Spacing)
Grid base de 4px:
- `space-1` (4px): Espaçamento interno entre ícone e texto.
- `space-2` (8px): Gaps internos em grupos compactos.
- `space-3` (12px): Padding interno de inputs e botões de slot.
- `space-4` (16px): **Padding lateral obrigatório no mobile (gutter)**.
- `space-6` (24px): Separação entre seções verticais.
- `space-8` (32px): Separação de blocos principais.

---

## 4. Elemento Memorável

**A Régua Tátil de Dias com Indicador de Vagas Imediatas.**

- **O que é**: Uma fita horizontal no topo do Passo 2 que mostra os próximos 7 dias em pílulas compactas com data e contador direto de vagas (ex: `Hoje · 3 vagas`, `Amanhã · 8 vagas`, `Qui · Esgotado`).
- **Por que é memorável**:
  1. Elimina a dor clássica do cliente de ficar clicando dia a dia em um calendário grego minúsculo só para descobrir que não tem vaga.
  2. Cria senso de oportunidade legítimo ("restam 2 vagas") sem precisar de pop-ups agressivos.
  3. Focado em uso real por celular com polegar (gesto natural de scroll horizontal).

---

## 5. Fluxo de Agendamento em 4 Passos (Wireframe ASCII Mobile 375px)

```text
+-----------------------------------+
| PASSO 1: ESCOLHA DO SERVIÇO       |
+-----------------------------------+
| Barbearia do Silva                |
| Rua Augusta, 1200 · Aberto        |
|                                   |
| Escolha o serviço:                |
| +-------------------------------+ |
| | Corte Cabelo + Barba          | |
| | 50 min · R$ 70,00             | |
| | Sinal de R$ 20,00 no Pix      | |
| | [ Selecionar ]                | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Corte Tradicional             | |
| | 30 min · R$ 45,00             | |
| | Sinal de R$ 15,00 no Pix      | |
| | [ Selecionar ]                | |
| +-------------------------------+ |
+-----------------------------------+

+-----------------------------------+
| PASSO 2: DIA E HORÁRIO            |
+-----------------------------------+
| Corte Cabelo + Barba (50 min)     |
|                                   |
| [Hoje · 2 vagas] [Amanhã · 5] >   |
|                                   |
| Horários disponíveis para Hoje:   |
| [ 14:00 ]  [ 15:00 ]  [ 16:30 ]   |
| [ 17:30 ]  [ 18:30 ]  [ 19:15 ]   |
|                                   |
| Horário selecionado: Hoje às 16:30|
| +-------------------------------+ |
| | Continuar (R$ 20 de sinal)    | |
| +-------------------------------+ |
+-----------------------------------+

+-----------------------------------+
| PASSO 3: SEUS DADOS               |
+-----------------------------------+
| Hoje, 16:30 · Corte + Barba       |
| Total: R$ 70 (Sinal agora: R$ 20) |
|                                   |
| Seu nome completo                 |
| [ Matheus Silva                 ] |
|                                   |
| WhatsApp (para confirmação)       |
| [ (11) 98765-4321               ] |
|                                   |
| +-------------------------------+ |
| | Gerar Pix de R$ 20,00         | |
| +-------------------------------+ |
+-----------------------------------+

+-----------------------------------+
| PASSO 4: PAGAMENTO DO SINAL PIX   |
+-----------------------------------+
| Quase lá! Pague para garantir     |
| Expira em 10:00 minutos           |
|                                   |
|         +---------------+         |
|         |    QR CODE    |         |
|         |      PIX      |         |
|         +---------------+         |
| Valor do sinal: R$ 20,00          |
|                                   |
| [ Copiar código Pix ]             |
|                                   |
| [ Já fiz o pagamento no banco ]   |
| Horário reservado temporariamente |
+-----------------------------------+
```

---

## 6. O que Vamos Evitar Rigirosamente

1. **Estética clichê de IA**:
   - Zero fundo creme/bege com tipografia com serifa clássica (estilo "spa boutique genérico").
   - Zero tema dark total com verde neon/ácido brilhante.
2. **Poluição visual e atrito**:
   - Sem rótulos em caixa alta espaçada (`S E R V I Ç O S`).
   - Sem números ordinais gigantes e puramente decorativos ("01", "02", "03").
   - Sem setas desnecessárias em botões (`Avançar ->`).
   - Sem degradês/gradientes roxo-rosa ou enfeites sem função de usabilidade.
3. **Perda de performance**:
   - Sem animações de fade-up lentas que atrasam a exibição no 4G de salão.
   - Sem modais aninhados ou calendários estilo desktop reduzidos à força.
