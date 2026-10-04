# Spec: Refatoração da Landing Page (T5-A)

## 1. Contexto e Objetivo
Refatorar os componentes de landing page (`components/landing/*`) para máxima conversão do público-alvo (dono de barbearia, salão, clínica, manicure, personal no Brasil), eliminando clichês de IA e obedecendo estritamente ao AGENTS.md §1, §6 e docs/PRECOS.md.

## 2. Decisões de Design e Conversão
1. **Preços Estritos**: R$ 49/mês (Base - 4900 centavos) e R$ 79/mês (Completo - 7900 centavos). Trial de 7 dias sem cartão de crédito.
2. **Proposta Única**: "Seu cliente agenda sozinho, paga o sinal por Pix e você para de perder horário."
3. **Eliminar Padrões Proibidos**:
   - Eliminar números falsos de sequência (`01`, `02`, `03`) em benefícios paralelos (`LandingEditorialBenefits`).
   - Eliminar tags de cabeçalho em CAIXA ALTA ESPAÇADA (`uppercase tracking-wider`) redundantes sobre títulos.
   - Usar português natural, direto, em caixa de frase (sentence case) e voz ativa.
   - Manter 1 única sequência de entrada respeitosa no Hero e sem animações desnecessárias por seção.
4. **Ergonomia e Acessibilidade**:
   - Todos os alvos de clique/toque com no mínimo 44px (pills e links com min-h-11 ou min-h-12).
   - Contraste AA nos estados claro e escuro.
   - `prefers-reduced-motion` respeitado.
   - Sem overflow horizontal em 375px.

## 3. Componentes no Escopo
1. `LandingHeader.tsx`: navegação sem rótulos genéricos, toque >= 44px.
2. `LandingHero.tsx`: narrativa direta, CTAs claros, garantias sem atrito.
3. `LandingHeroVisual.tsx`: visual do cartão Pix e agenda sem badges de template.
4. `LandingTrustBand.tsx`: segmentos reais atendidos sem CAIXA ALTA artificial.
5. `LandingEditorialBenefits.tsx`: 4 vantagens sem numeração "01/02/03", sem tracking falso.
6. `LandingHighlightBanner.tsx`: passo a passo legítimo (1, 2, 3), copy natural.
7. `LandingInteractiveDemo.tsx`: demonstração tátil em 4 etapas reais.
8. `LandingPainSolution.tsx`: comparativo do prejuízo real (calote vs sinal pago).
9. `LandingPricing.tsx`: planos Base R$ 49 e Completo R$ 79 com CTAs diretos e centavos.
10. `LandingFaq.tsx`: dúvidas reais sobre Pix, no-show e teste de 7 dias.
11. `LandingFooter.tsx`: links úteis e rodapé enxuto.
