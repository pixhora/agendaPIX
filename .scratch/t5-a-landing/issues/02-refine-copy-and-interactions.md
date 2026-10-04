# Issue 02: Refinar Copy e Acessibilidade em Hero, Banner, Demo e Pricing

Status: ready-for-agent
Type: task

## Descrição
Ajustar textos e interações para linguagem objetiva do dono de negócio brasileiro:
- Preços rigorosamente alinhados a docs/PRECOS.md: R$ 49/mês (Base) e R$ 79/mês (Completo), 7 dias de teste grátis sem cartão.
- CTAs ativos e diretos ("Começar teste de 7 dias grátis", "Criar minha agenda agora").
- Garantir alvos de toque >= 44px, contraste AA e ausência de transições bruscas sob `prefers-reduced-motion`.
- Verificação visual e responsiva em 375px sem transbordamento.

## Arquivos
- `components/landing/LandingHero.tsx`
- `components/landing/LandingHeroVisual.tsx`
- `components/landing/LandingHighlightBanner.tsx`
- `components/landing/LandingInteractiveDemo.tsx`
- `components/landing/LandingPricing.tsx`
