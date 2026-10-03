# Medição de peso do dashboard — T2

## Método reproduzível

Comando: `node docs/evidencias/t2-peso/measure.mjs`.
Ambiente: Linux, Node 22.23.3, artefatos Next 16.3.8 existentes em `.next` (build de 2026-10-03 12:57 UTC). A medição não recria build, não inicia servidores e não consulta banco.

O script soma arquivos únicos de `rootMainFiles` e `clientModules` em cada manifesto. Inclui chunks de boundaries de erro; portanto representa um conjunto de artefatos referenciados, não uma medição de download inicial do browser. Gzip é calculado localmente, por arquivo. Exclui HTML/RSC, CSS, polyfills condicionais, tempo de execução e efeito do cache. Resultados completos: `results.json`.

| Rota | JS bruto, bytes | Gzip local, bytes |
| --- | ---: | ---: |
| `/dashboard` | 531600 | 162233 |
| `/dashboard/customers` | 531600 | 162233 |
| `/dashboard/services` | 536995 | 164008 |
| `/dashboard/settings` | 536995 | 164008 |
| `/dashboard/login` | 523186 | 158684 |

Serviços e funcionamento acrescentam 5395 bytes brutos / 1775 bytes gzip ao conjunto da agenda. Os dois usam o mesmo módulo de formulários; o peso medido não justifica separar componentes ou criar dependências. Runtime compartilhado representa 440491 bytes brutos / 130828 bytes gzip na agenda. Sem orçamento aprovado, baseline comparável ou medição de latência, esses números não comprovam regressão de desempenho.

## Falhas e limites revisados

- Contrato administrativo: T1 aprovou Server Components/Server Actions; previsão REST duplicada removida. Bloqueio documental resolvido.
- Falha de DB expondo token: prova histórica sanitizada em `../t2-2026-10-03/auth-log-redacted.txt`. T1 informa correção de logger, gates em execução e hash pendente; não copiada nem verificada por T2.
- Recuperação de erro e sucesso de gravação: correções/provas anteriores permanecem em `../../VERIFICACAO-T2-2026-10-03.md`. Não foram reproduzidas novamente nesta medição.
- O harness temporário anterior `/tmp/agenda-t2-verification` não está disponível. Logs e capturas persistem; repetir browser exige reconstruir fixtures descartáveis. QA independente e suíte E2E permanente continuam pendentes.
- Nenhum novo defeito do painel foi reproduzido nesta revisão. Não houve alteração de código de produto, otimização especulativa, chamadas bancárias ou intervenção em sessões/preview.

Próximos responsáveis: T1 fornecer hash e resultado do logger; T3 confirmar regressões e isolamento quando conectado; T2 medir transferência/execução no browser caso haja sintoma de lentidão ou baseline para comparação.
