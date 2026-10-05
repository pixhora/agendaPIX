# Operação Maestri

Objetivo: reduzir conflitos e custo de coordenação sem perder contexto ou controles de segurança.

## Plano implementado

1. Atualizar a nota compartilhada existente, preservando histórico e missões. Separar regras atuais de diagnósticos antigos que exigem revalidação.
2. Padronizar cada tarefa com dono, escopo exato, dependências, critério observável e entrega com commit/provas.
3. Manter checkpoints em PROGRESSO.md, buscas focadas e leitura de dependências diretas. Evitar prompts repetidos e testes redundantes; cumprir verificações obrigatórias.
4. Usar revisão proporcional ao risco: QA para comportamento, Prisma para UX e Tech Lead para contratos/auth/tenant/pagamentos e mudanças transversais. Não centralizar cada alteração cosmética no Tech Lead.
5. Separar enviado, recebido, implementado, validado e integrado. Verificar a worktree realmente servida antes de julgar screenshots.

## Critério operacional

- Uma tarefa tem um dono e um critério verificável; nenhum arquivo tem autores concorrentes sem acordo.
- Um bloqueio informa causa, responsável e próxima ação; o agente pode executar trabalho independente autorizado.
- Uma entrega inclui commit, resultados reais e pendências. Produção não é aprovada com mock/Preview.
- Contexto essencial sobrevive à compactação em checkpoint, sem reset de sessão.
- Economia de tokens é uma orientação de trabalho, não uma redução medida nem uma garantia de capacidade superior.

## Limites

A nota não altera modelos, quota ou inteligência dos agentes. Recebimento e adesão exigem confirmação dos terminais. Não houve merge, push, reinício de sessões ou mudança de código do produto nesta configuração.
