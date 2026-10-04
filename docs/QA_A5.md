# A5 — preparação da regressão de animações

Status: preparada, aguardando commits A1/A2/A3 e URLs correspondentes. Nenhuma aprovação ou execução nova de navegador nesta preparação.

## Escopo e critérios

T3 mantém autoria exclusiva dos testes na worktree `agenda-tests`, branch `feat/tests`. Não altera produto. Registrar para cada execução commit servido, URL, viewport, tema, movimento e artefatos Playwright. Preview e API mock são provas de interface; não comprovam pagamento real ou persistência de produção.

Executar em 375px e 1280px, claro/escuro, movimento normal/reduzido. Reutilizar `tests/qa/booking-ui.spec.ts`, `preview.spec.ts`, `slot-ruler.spec.ts` e configurações existentes, selecionando somente testes afetados.

- Booking: serviço/horário/dados, voltar e avançar. Nome/telefone e seleções devem permanecer; foco deve ficar utilizável. Antes de enviar, nenhuma reserva criada; submissão pendente e ativação repetida não podem criar duas reservas. Contar POST de reserva por ação, não polling autorizado de status. Confirmação exige resposta confirmada; QR/copia-e-cola e resposta pendente não confirmam.
- Preview: mesma volta e preservação; nenhuma chamada API ou externa. Confirmação somente após ação explícita de simulação; manter identificação Preview.
- Onboarding: preencher negócio e serviço, voltar/avançar, preservar rascunho e foco. Erro permanece acessível; sucesso somente após resposta real. Não acionar email real: interceptar envio ou usar caixa sintética autorizada.
- Reduced-motion: conteúdo e ações continuam disponíveis; nenhum deslocamento/loop nos componentes alterados. Avaliar estado final e estilos/animações ativas, sem exigir duração exata.
- Teclado/overflow: Tab, Shift+Tab, Enter e setas onde previstas; foco enquadrado e visível, último dia alcançável; documento sem overflow horizontal. Conferir controles em cada etapa, não apenas Pix.
- Dashboard A2: somente delta de menu/formulários após commit e ambiente com login sintético autorizado. Preservar campos/foco/scroll; um envio por ação e sucesso após resposta. Não bypass de sessão.

## Reuso e ajustes após entrega

Cobertura existente inclui estados de serviços/horários, conflito, estados Pix, hidratação de onboarding, teclado, contraste, régua e overflow. Ampliar esses casos somente onde o delta exigir; não duplicar suíte inteira.

`tests/qa/preview.spec.ts` contém espera fixa de 4500ms no fluxo local. Ao adaptar o cenário A5, substituir por resposta/estado observável; não usar espera fixa para provar ausência de requests. A observação deve abranger as ações e a confirmação, com contagem final. O teste existente de reduced-motion usa limite de duração; acrescentar prova funcional e ausência de movimento, sem teste de duração exata.

Comandos preparados (URLs substituídas somente após handoff):

```bash
PREVIEW_BASE_URL=<URL_BOOKING> pnpm exec playwright test --config=tests/qa/playwright.config.ts --grep '<casos afetados>'
PREVIEW_BASE_URL=<URL_PREVIEW> pnpm exec playwright test --config=tests/qa/preview.config.ts --grep '<casos afetados>'
```

A configuração QA usa `PREVIEW_BASE_URL` também para booking com API mock. Usar origem própria do onboarding quando separada; não presumir que booking serve cópia atual de T5.

## Handoff esperado

TAREFA: A5, regressão do delta, T3.
ESCOPO: commit/worktree servido, arquivos alterados, URL booking/Preview/onboarding/dashboard e tokens A1.
PRONTO: critérios acima observados, testes afetados e evidências; falhas com arquivo/linha, reprodução, impacto e autor.
DEVOLVA: commit dos testes, resultados reais, artefatos e bloqueios. Aguardar autores; nenhum gate repetido antes de mudança relevante.
