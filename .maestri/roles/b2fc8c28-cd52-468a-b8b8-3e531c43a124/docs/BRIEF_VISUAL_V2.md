# Brief visual v2 e tokens v2

Proposta de integração. Não altera worktree alheia. Referência: `ref_whale_loans.png` (norte, sem clonar layout nem marca). Sucede a regra de fonte única de `CONTRATO-TOKENS.md`: T4 publica a v2 em `agenda-booking-ui/docs/design-tokens.md` e `app/globals.css`; T5 e T2 copiam o bloco.

## Direção

Fundo off-white, uma placa preta de valor, números gigantes, um acento. Hierarquia por tamanho e contraste, não por cor.

**Elemento-assinatura (um só): a placa de valor.** Cartão `--slab` com um número em 64 px branco. Onde aparece:

- Booking: o sinal a pagar, em reais (vem do servidor em centavos).
- Painel: sinais confirmados do dia e próxima reserva.
- Landing: o preço do plano.

O resto fica quieto: sem fade-up por seção, sem hover em todo card, sem gradiente, sem CAIXA ALTA em título, sem seta em todo botão.

## Conflito com AGENTS.md seção 6

A seção 6 manda evitar "preto + verde ácido como padrão automático". O brief pede preto e lima. Mitigação obrigatória: lima nunca é fundo grande nem botão; só ponto de estado, chip e traço fino. Botão primário é pílula preta. Se o humano aceitar essa leitura, registrar a exceção em `docs/design-tokens.md`.

## Cores (6) e sistema

| Nome | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--paper` | `#F6F5F2` | `#0F0F10` | Fundo da página |
| `--surface` | `#FFFFFF` | `#19191B` | Cartões e moldura |
| `--ink` | `#0B0B0C` | `#F6F5F2` | Texto, botão primário, placa |
| `--muted` | `#5B5B5F` | `#A3A3A8` | Rótulos e apoio |
| `--line` | `#DEDCD6` | `#2C2C2F` | Divisores e contorno |
| `--lime` | `#C0F739` | `#C0F739` | Ponto de estado, chip, trend |

Placa: `--slab` `#0B0B0C` no claro e `#000000` no escuro, com `--line` de borda. Texto da placa `#FFFFFF`.

Sistema (fora das 6): erro `#B3261E` claro, `#FF8A80` escuro.

Contraste medido por cálculo, não por ferramenta: ink sobre paper ≈ 18:1; muted sobre paper ≈ 6:1; branco sobre slab ≈ 19:1; lima sobre slab ≈ 15:1. **Lima sobre paper ≈ 1,2:1: proibido para texto, borda de foco ou ícone sozinho no claro.** Foco no claro: anel `--ink` 2 px com offset. No escuro: anel lima.

## Escala

Tipo: 14 / 16 / 20 / 28 / 40 / 64 px. Linha de texto até 70 caracteres. Números da placa em 64 px (40 px abaixo de 375 px de largura útil). `font-variant-numeric: tabular-nums` em valores e horários.

Famílias (máx. 2): Plus Jakarta Sans nos títulos e números, Inter no texto. Já carregadas por `next/font`; sem troca.

Espaço: 4, 8, 12, 16, 24, 32, 48, 64. Raios: moldura 32 px (28–40), cartão 14 px (12–16), campo 12 px, botão e chip pílula. Sombra só em sobreposição: `0 8px 24px rgb(11 11 12 / 10%)`.

Movimento: mantém 120 / 180 / 240 ms de T4. `prefers-reduced-motion`: sem deslocamento nem loop.

## Bloco para `app/globals.css`

```css
:root {
  --paper: #F6F5F2;
  --surface: #FFFFFF;
  --ink: #0B0B0C;
  --muted: #5B5B5F;
  --line: #DEDCD6;
  --lime: #C0F739;
  --slab: #0B0B0C;
  --slab-foreground: #FFFFFF;
  --danger: #B3261E;
  --ring: #0B0B0C;
  --radius-frame: 32px;
  --radius-card: 14px;
  --radius-field: 12px;

  /* Aliases v1: manter uma rodada para T2/T5 não quebrarem */
  --background: var(--paper);
  --foreground: var(--ink);
  --muted-foreground: var(--muted);
  --border: var(--line);
  --primary: var(--ink);
  --primary-foreground: var(--paper);
  --accent-lime: var(--lime);
  --accent-forest: var(--ink);
}

.dark {
  --paper: #0F0F10;
  --surface: #19191B;
  --ink: #F6F5F2;
  --muted: #A3A3A8;
  --line: #2C2C2F;
  --lime: #C0F739;
  --slab: #000000;
  --slab-foreground: #FFFFFF;
  --danger: #FF8A80;
  --ring: #C0F739;
  --primary-foreground: #0B0B0C;
}
```

`prefers-color-scheme: dark` repete o bloco `.dark` como fallback quando não houver classe. Não duplicar valores à mão em outros arquivos.

**Quebra de semântica:** `--primary` deixa de ser lima e vira tinta. Todo `bg-primary` passa a pílula preta; todo `text-primary` sobre claro passa a texto preto. Revisar usos antes de trocar: `rg "text-primary|bg-primary|accent-forest|accent-lime"` em cada worktree.

## Telas e donos

| Frente | Dono | Ordem |
| --- | --- | --- |
| Tokens v2, `design-tokens.md`, `globals.css`, componentes base (botão pílula, chip, placa) | T4 | 1 |
| Booking `/[slug]`: placa do sinal, régua de datas, passos | T4 | 2 |
| Preview | T4 | 2 |
| Landing e onboarding | T5 | 3, após o bloco publicado |
| Painel `/dashboard/*`, login | T2 | 3, após o bloco publicado |
| Revalidação visual | T6 | 4 |
| Prova automática 375 / 1280, claro e escuro, console limpo | T3 | 4 |

T5 e T2 não criam segunda paleta. Painel autenticado hoje usa `#1d4ed8` (`agenda-dashboard/app/globals.css:6`); sai nessa rodada.

## Limites que não mudam

- Dinheiro em centavos; a placa só formata o valor que o servidor devolveu. Nunca calcula sinal.
- Pix fake continua rotulado como simulação. A placa de pagamento não anima sucesso antes do estado confirmado pelo servidor.
- Proxies do booking, auth na 3000 e a chave Pix do painel ficam como estão.
- Sem nova dependência. Sem merge, push nem deploy.

## Prova de pronto por worktree

Capturas 375 e 1280, claro e escuro, console sem erro, foco visível por teclado, alvos de 44 px, movimento reduzido. `lint`, `typecheck` e `test` verdes. Relatório curto por worktree com commit, comandos e resultado real.
