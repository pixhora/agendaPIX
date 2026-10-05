# SKILLS MATT POCOCK — instalação e mapeamento por agente

Hermes (Operação/Performance) — 2026-10-04. Fonte: https://github.com/mattpocock/skills (MIT, v1.3.1).

## 1. Auditoria antes de instalar (feita)
Repo inspecionado antes de copiar: sem installer executável (`scripts/link-skills.sh` é dev-only, só
faz symlink), sem coleta de credencial, sem POST para fora, sem `rm -rf`/`sudo`/`eval`. Únicas URLs
são documentação/referência. Licença MIT. **Aprovado para instalar.**

## 2. O que foi instalado (36 skills, verificado)

| Harness | Caminho | Como |
|---|---|---|
| Hermes (eu) | `~/.hermes/skills/mattpocock-{engineering,productivity,misc,in-progress}/<skill>/` | cópia real |
| Codex (T1–T3) | `~/.codex/skills/<skill>` | symlink → `~/.agents/skills` |
| Antigravity/agy (T4–T6) | `~/.gemini/config/skills/<skill>` | symlink → `~/.agents/skills` |
| Claude Code | `~/.claude/skills/<skill>` | symlink → `~/.agents/skills` |
| Acervo mestre | `~/.agents/skills/<skill>` | cópia real |

Clone permanente: `~/mattpocock-skills` (permite `git pull` para atualizar). Manifesto atualizado em
`~/.agents/agenda-skills-installation.json`. `grill-me` foi PULADO: já existia byte-idêntico.

## 3. Adaptação obrigatória: essas skills são escritas para Claude Code

Onde elas dizem "Call the Skill tool with X":
- Hermes: `skill_view("X")`
- Codex / agy: invocar a skill pelo nome, como já fazem.

Elas assumem um issue tracker em `docs/agents/issue-tracker.md`. **Ele não existe ainda** neste repo.
Primeiro passo de quem for usar `to-spec`/`to-tickets`/`triage`/`wayfinder`/`code-review`:
rodar a skill `setup-matt-pocock-skills` UMA vez (sem tracker, ela cai no tracker markdown local).

## 4. O fluxo que forma a equipe (pipeline)

`wayfinder` (mapear o desconhecido) → `to-spec` (virar spec) → `to-tickets` (fatiar) →
`implement`/`implement-spec` (fazer com `tdd`) → `code-review` (2 eixos: padrões + spec) →
`retro`. O resto são ferramentas pontuais em volta.

## 5. Mapeamento — qual agente segue o quê

| Agente | Skills principais | Por quê |
|---|---|---|
| T1 Backend | `tdd`, `implement`, `implement-spec`, `domain-modeling`, `codebase-design`, `diagnosing-bugs`, `research`, `wizard` | dinheiro exige teste primeiro; `wizard` para Pix/Resend/credenciais que só o humano faz |
| T2 Painel | `tdd`, `implement`, `diagnosing-bugs`, `prototype`, `code-review` | CRUD com contrato fechado; `prototype` para decidir tela antes de construir |
| T3 QA/Revisor | `code-review`, `diagnosing-bugs`, `tdd`, `triage` | revisão em dois eixos com evidência, não opinião |
| T4 Frontend | `prototype`, `grill-with-docs`, `codebase-design`, `domain-modeling`, `implement`, `tdd`, `writing-for-agents` | decidir a identidade antes de codar; `writing-for-agents` para escrever componentes/tokens legíveis |
| T5 Conversão | `grilling`, `to-spec`, `to-tickets`, `prototype`, `writing-for-agents`, `ask-matt` | transformar ideia em oferta testável; `ask-matt` roteia o resto |
| T6 UX/UI Audit | `triage`, `code-review`, `diagnosing-bugs`, `to-questionnaire`, `wait-what` | classificar achados e devolver ao dono sem reescrever |
| Cursor (tech lead) | `wayfinder`, `improve-codebase-architecture`, `codebase-design`, `domain-modeling`, `code-review`, `retro` | decisões transversais e arquitetura |
| Hermes (ops) | `diagnosing-bugs`, `wizard`, `setup-matt-pocock-skills`, `retro`, `handoff`, `claude-handoff` | startup/performance: diagnosticar, não chutar |
| Maestri | `ask-matt`, `wayfinder`, `handoff` | orquestrar sem perder contexto |

## 6. Não promovidas (de propósito)
- `misc/*` (`git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, `setup-pre-commit`):
  o próprio repo não promove. Instaladas, mas sem uso diário.
- `in-progress/*` (`claude-handoff`, `loop-me`, `setup-ts-deep-modules`, `writing-beats/fragments/shape`):
  o repo as expõe de propósito para feedback. Usar com cautela.

## 7. Aviso de carga de contexto
Todas as skills são listadas com nome+descrição em TODO turno de quem as carrega. 36 skills novas =
mais contexto por sessão. Use o mapeamento acima: cada agente segue as SUAS, não todas.
