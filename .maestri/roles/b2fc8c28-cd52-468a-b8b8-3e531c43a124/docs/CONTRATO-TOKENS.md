# Contrato — fonte única de tokens

Proposta. Sem implementação. Heads da deriva: booking-ui `5b4c3ad`, dashboard `206a5a3`, conversion `c588f20`.

## Fonte

T4 é a única fonte. Arquivos:

- `agenda-booking-ui/docs/design-tokens.md`
- `agenda-booking-ui/app/globals.css`

Valores que os outros não podem redefinir:

| Token | Claro | Escuro |
| --- | --- | --- |
| `--background` | `#f5f6f2` | `#0e1612` |
| `--primary` | `#c0f739` | `#c0f739` |
| `--primary-foreground` | `#111613` | `#111613` |
| `--accent-forest` | `#0f3b2e` | `#175442` |
| `--duration-feedback` | `120ms` | `120ms` |
| `--duration-opening` | `180ms` | `180ms` |
| `--duration-step` | `240ms` | `240ms` |

Fonte tipográfica: Plus Jakarta Sans nos títulos, Inter no texto. T4 altera hex ou duração no mesmo commit em que atualiza `design-tokens.md`.

## Consumo

T2 e T5 não criam segunda paleta. O painel hoje usa `#1d4ed8` em `agenda-dashboard/app/globals.css:6`. A landing repete floresta e lima em `agenda-conversion/app/globals.css:15` e não declara `--duration-feedback`. Essas cópias manuais são a deriva.

Enquanto não houver um app único, T2 e T5 copiam só o bloco `:root` e o bloco escuro desses tokens, a partir do CSS de T4. Não inventam `--primary` local. Componente visual novo usa esses nomes. Não usa hex solto de azul, lima ou floresta.

## O que impede a deriva

1. Um nome, um valor. `--primary` é lima. Azul `#1d4ed8` não volta como primária.
2. T2 e T5 não editam `design-tokens.md` nem o bloco de tokens de T4.
3. Mudança de cor ou duração nasce em T4 e só então entra no CSS de T2 e T5, no mesmo acordo, com o hex citado.
4. Fallback local, como o `120ms` do módulo de movimento do painel, não substitui a variável de T4 quando ela existir.
5. Preview, landing e painel que discordem desses hex estão fora do contrato, mesmo com a tela funcionando.

## Pronto

Os três `globals.css` resolvem `--primary` para `#c0f739` e `--accent-forest` claro para `#0f3b2e`. O painel não contém `#1d4ed8` como primária. T5 declara as três durações. Nenhuma dependência nova entra só para compartilhar token.
