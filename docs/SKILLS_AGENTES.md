# Skills por agente

Seleção e instalação: 2026-10-03. Objetivo: produtividade, performance e qualidade visual com leitura sob demanda. Não há ranking universal de melhores skills nem ganho de tokens medido.

## Seleção

Foram consultados o catálogo skills.sh, buscas de performance React e revisão visual, o catálogo oficial OpenAI e os arquivos das skills selecionadas. Fontes externas novas: `vercel-labs/agent-skills` e `openai/skills`. Repositórios oficiais e conteúdo aderente à stack tiveram prioridade sobre contagem de instalações.

Novas instalações:

- `vercel-react-best-practices`: waterfalls, bundles, renderização e performance React/Next. Fonte: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- `web-design-guidelines`: auditoria de UI e acessibilidade. Fonte: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- `security-best-practices`: revisão de segurança TypeScript/Next/React. Fonte: https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices
- `security-threat-model`: fronteiras de confiança e ameaças, quando essa análise for solicitada. Fonte: https://github.com/openai/skills/tree/main/skills/.curated/security-threat-model
- `playwright`: navegação e evidências via CLI; não substitui a suíte Playwright Test existente. Fonte: https://github.com/openai/skills/tree/main/skills/.curated/playwright

Skills locais já existentes foram reutilizadas sem sobrescrever: frontend-design, design-system, ui-ux-pro-max, agent-browser, caveman, investigate-first, lean-build, surgical-patch, verify-and-stop e migration. A skill claude-design já existente no Hermes continua referência opcional de direção visual; não foi usada para criar uma aplicação HTML paralela.

## Uso por papel

| Agente | Seleção prioritária | Quando usar |
| --- | --- | --- |
| T1 Codex | investigate-first, security-best-practices, migration, surgical-patch | Diagnóstico, auth/tenant/pagamentos, migrations e correções backend. |
| T2 CODEXADO | frontend-design, vercel-react-best-practices, web-design-guidelines | Painel mobile, legibilidade, estados, bundle e renderização. |
| T3 CODEFICADO | investigate-first, agent-browser, playwright, verify-and-stop | Reprodução, inspeção de navegador e prova de regressão. Manter testes automatizados existentes. |
| T4 Antigravidade | frontend-design, design-system, vercel-react-best-practices | Booking, componentes compartilhados, tokens e performance. ui-ux-pro-max apenas para decisão UX específica. |
| T5 Trilha | frontend-design, web-design-guidelines, vercel-react-best-practices | Landing e onboarding coerentes, CTA acessível e carregamento rápido. Reutilizar tokens de T4. |
| T6 Prisma | web-design-guidelines, agent-browser, verify-and-stop | Auditoria visual independente com screenshot, URL, tema, viewport e commit. Não assumir implementação. |
| Codex Revisor | investigate-first, security-best-practices, verify-and-stop | Revisão técnica por risco e revalidação de correções. |
| cursor-tech-lead | security-best-practices, security-threat-model, vercel-react-best-practices | Revisão transversal de segurança, contratos e performance. Não implementar sem autorização pertinente. |

Todos: caveman para mensagens concisas. lean-build para tarefas com risco de escopo excessivo, quando pertinente. Não carregar o conjunto inteiro em cada tarefa; escolher a skill que resolve o problema e somente referências relacionadas.

## Instalação e prova

- Codex: `~/.codex/skills`, 13 entradas selecionadas disponíveis.
- Antigravity atual: `~/.gemini/config/skills`, 11 entradas. Caminho confirmado pela documentação local `agy-customizations`.
- Cursor: `~/.cursor/skills`, 8 entradas.
- Registro local: `/var/home/matheus/.agents/agenda-skills-installation.json`.
- Foram verificados 32 caminhos nativos com SKILL.md acessível; instalações preexistentes preservadas. Links apontam para pacotes locais completos, com referências/scripts mantidos.
- Instalação é por cliente e usuário compartilhado. Terminais do mesmo cliente enxergam o mesmo catálogo; a tabela orienta especialização por papel.
- Skills ficam disponíveis para descoberta no próximo turno. Descoberta automática e uso efetivo por cada sessão precisam de confirmação; nenhuma sessão foi reiniciada.

## Regras de aplicação

Instruções do usuário, sistema e AGENTS.md prevalecem. Exemplos de versão devem ser conferidos com Next instalado. Recomendações de bibliotecas não autorizam adicionar dependências por padrão. Segurança/tenant não podem ser sacrificados por cache ou otimização. Preservar design aprovado; skill de design não autoriza mudança arbitrária da marca.

Evitar varreduras repetidas, carga integral de guias compilados e otimização sem problema comprovado. Reutilizar o navegador já padronizado; não alternar ferramentas sem necessidade. Instalação não muda modelo, quota ou capacidade intrínseca, nem aprova produção.
