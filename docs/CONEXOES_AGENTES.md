# Conexões mínimas da equipe

Pedido em 2026-10-04: reduzir conexões entre pares, preservando agentes, missões, sessões, notas e portais.

## Topologia desejada

Todos continuam conectados ao Codex/Maestri coordenador. Comunicação direta entre pares fica limitada a:

| Par | Necessidade |
| --- | --- |
| CODEXADO — Antigravidade | Tokens e componentes compartilhados usados pelo painel. |
| Antigravidade — Trilha | Design system comum ao booking, landing e onboarding. |
| Antigravidade — Prisma | Auditoria e revalidação de UX dos componentes compartilhados. |
| Trilha — Prisma | Auditoria e revalidação de landing e onboarding. |
| CODEXADO — Codex Revisor | Correções e revisão técnica do painel. |

QA e Tech Lead continuam acessíveis ao coordenador, que encaminha commits e reúne evidências. Seus contatos diretos com todos os autores não são necessários permanentemente. Auditorias do painel por Prisma também passam pelo coordenador. Não criar outra conexão sem necessidade concreta.

## Cordas entre pares a remover

- CODEXADO — CODEFICADO
- CODEXADO — Prisma
- CODEXADO — cursor-tech-lead
- CODEFICADO — Antigravidade
- CODEFICADO — Codex Revisor
- CODEFICADO — cursor-tech-lead
- Antigravidade — cursor-tech-lead
- Trilha — cursor-tech-lead
- Prisma — cursor-tech-lead

Preservar todas as cordas ao coordenador, à nota compartilhada e aos portais. Não apagar terminais nem reiniciar processos para alterar conexões.

## Regra operacional aplicada

Novos handoffs seguem a topologia desejada mesmo enquanto cordas antigas existem. Contatos pendentes podem concluir; não cancelar trabalho nem reenviar prompts. Coordenador encaminha pedidos fora dos pares permitidos.

## Limitação verificada

O CLI instalado possui `connect`, mas não `disconnect`. A remoção visual ainda não foi executada. A lista acima descreve o resultado desejado, não uma topologia já alterada. Remover somente essas nove conexões pela interface do canvas e conferir o resultado com `maestri list`.
