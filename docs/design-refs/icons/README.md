# Referências visuais — ícones (agendaPIX)

Pesquisa para enriquecer a UI com `lucide-react` de forma profissional e consistente (pedido do Matheus). Capturas leves em WebP; Dribbble (captcha) e Mobbin (login) foram **pulados**.

## Decisão (resumo)

| Tema | Escolha |
|---|---|
| Biblioteca | **Só lucide-react** (já no projeto; alinhado ao shadcn new-york) |
| Stroke | `strokeWidth={1.75}` + `absoluteStrokeWidth` |
| Tamanhos | 16px inline/campos · 20px botões/lista/KPI · 24px nav |
| KPI | Glifo 20px num quadrado 36–40px (`rounded-xl`) com fundo accent claro (`bg-pix-soft`) |
| Cor | `text-muted` / muted-foreground por padrão; cor só em status e item ativo |
| A11y | Decorativos com `aria-hidden`; botão só-ícone com `aria-label` |
| Código | Wrapper `components/ui/icon.tsx` + mapas em `lib/icons/registry.ts` |

Página pública: inspiração Stripe Checkout — **poucos ícones**, sem poluir.

Detalhes e mapeamento por superfície: `docs/DESIGN_DECISION.md` § Ícones.

## Tabela das capturas

| Arquivo | URL / origem | O que mostra | Por que importa |
|---|---|---|---|
| `01-lucide-calendar.webp` | [lucide.dev/icons/?search=calendar](https://lucide.dev/icons/?search=calendar) | Família calendar no Lucide | Candidato a data/agenda; confirma nomenclatura (`calendar-days`) |
| `02-lucide-clock.webp` | [lucide.dev/icons/?search=clock](https://lucide.dev/icons/?search=clock) | Clock / timer | Duração, horário e timer do Pix |
| `03-lucide-qr.webp` | [lucide.dev/icons/?search=qr](https://lucide.dev/icons/?search=qr) | QR code | Passo Pix e identidade do pagamento |
| `04-lucide-wallet.webp` | [lucide.dev/icons/?search=wallet](https://lucide.dev/icons/?search=wallet) | Wallet | KPI / chave Pix / dinheiro recebido |
| `05-lucide-shield.webp` | [lucide.dev/icons/?search=shield](https://lucide.dev/icons/?search=shield) | Shield / shield-check | Selo de pagamento seguro |
| `06-lucide-message.webp` | [lucide.dev/icons/?search=message](https://lucide.dev/icons/?search=message) | Message-circle | WhatsApp genérico (sem logo de marca) |
| `07-heroicons-calendar-outline.webp` | [heroicons.com](https://heroicons.com) (outline) | Calendar outline | Comparar peso de traço outline vs Lucide |
| `08-heroicons-calendar-solid.webp` | [heroicons.com/solid](https://heroicons.com) (solid) | Calendar solid | Comparar preenchimento; descartado (ficar só outline Lucide) |
| `09-phosphor-calendar-regular.webp` | [phosphoricons.com/?q=calendar](https://phosphoricons.com/?q=calendar) | Calendar regular Phosphor | Referência de cantos e peso “regular” |
| `10-tabler-calendar-outline.webp` | [tabler.io/icons?q=calendar](https://tabler.io/icons?q=calendar) | Calendar Tabler | Stroke fino similar ao alvo 1.75 |
| `11-calcom-booking-widget.webp` | [cal.com](https://cal.com) | Widget de booking | Densidade de ícones em agendamento SaaS |
| `12-calendly-feature-tabs.webp` | [calendly.com](https://calendly.com) | Tabs / features | Ícones de passo e navegação em produto de agenda |
| `13-fresha-search-fields.webp` | [fresha.com](https://fresha.com) | Campos de busca | Ícones inline em campos (local, serviço) |
| `14-stripe-checkout.webp` | [stripe.com/payments/checkout](https://stripe.com/payments/checkout) | Checkout Stripe | **Poucos ícones**, hierarquia tipográfica — referência da página pública |
| `15-lucide-circle-check.webp` | [lucide.dev/icons/?search=circle-check](https://lucide.dev/icons/?search=circle-check) | Circle-check | Status pago / confirmação (nome novo vs `CheckCircle`) |

## Fora do escopo desta pasta

- **Dribbble** — bloqueado por captcha; não capturado.
- **Mobbin** — exige login; não capturado.
