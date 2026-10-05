# Plano de segurança — autenticação e integração

Data: 2026-10-03. Revisão inicial; não equivale a aprovação de produção.

## Evidências verificadas

- O processo HTTP em 3343 executa a worktree `agenda-dashboard`.
- A origem de `BETTER_AUTH_URL` herdada pelo processo não corresponde a `http://localhost:3343`. É uma divergência de configuração; confirmar o status do pedido válido antes de atribuir toda a falha a ela. Não remover `trustedOrigins`.
- SMTP herdado aponta para servidor local. Disponibilidade desse servidor e entrega externa ainda não verificadas. Nenhum email real foi enviado nesta auditoria.
- `GET /api/auth/get-session` respondeu 200. Isso não verifica banco, entrega de email ou login completo.
- Pedido com email inválido respondeu 400 `VALIDATION_ERROR`.
- `lib/auth.ts` usa token de link armazenado como hash e origem confiável explícita. `lib/email.ts` aguarda envio SMTP; não simula sucesso.
- A integração existente testa hash do token e rejeição de segundo uso, mas não foi reexecutada nesta revisão.
- Better Auth instalado aplica expiração padrão de 300 segundos. Rate limit é habilitado por padrão em produção e usa memória; desenvolvimento não o habilita por padrão.
- O login de `agenda-conversion/app/login/page.tsx` transforma falha 500/rede em sucesso simulado no desenvolvimento. Não transportar esse comportamento para login real.

## Divisão de trabalho

- Codex/T1: configuração e diagnóstico de auth/SMTP; controles backend; plano e contratos.
- cursor-tech-lead: revisão independente de sessão, callbacks, tenants, endpoints, pagamentos e integração entre worktrees. Relatório pendente, com classificação OK/MELHORAR/BLOQUEIA.
- T2/T5: apresentação dos erros e login real coerente; nenhuma decisão de autorização no frontend.
- T3: testes negativos e regressão; revisor não reescreve implementação dos responsáveis.

## Ordem de execução e critérios

1. **P0 — T1: restabelecer login no ambiente servido.** Conferir configuração efetiva da origem e SMTP com saída sanitizada; alinhar origem à URL usada sem wildcard; validar SMTP em caixa de desenvolvimento. Dependência: ambiente de execução identificado. Pronto: envio recebido na caixa de teste, link cria sessão e leva ao painel; erro de entrega nunca aparece como sucesso. Entrega real ao usuário depende de SMTP autorizado, remetente e domínio configurados.
2. **P0 — Tech Lead + T1: verificar barreiras de acesso.** Revisar cookies HttpOnly/SameSite/Secure sob HTTPS, callbacks externos, expiração, consumo único inclusive concorrente, logout e isolamento de tenant. Dependência: código real das worktrees e integração. Pronto: achados com arquivo/linha, testes negativos e nenhum BLOQUEIA pendente. Não adicionar senha/MFA por suposição; link mágico depende da segurança da caixa de email.
3. **P0 — T1/T5: impedir bypass e sucesso fictício.** Manter mocks limitados ao Preview; login real não simula envio, sessão ou autorização. Dependência: contrato auth definido. Pronto: falha SMTP/rede não gera sucesso; Preview não acessa dados reais nem concede sessão.
4. **P1 — T1: controlar abuso.** Verificar limites de solicitação/consumo de links e proteção contra enumeração; definir armazenamento de limites compatível com número real de instâncias; não confiar em IP encaminhado sem proxy confiável. Dependência: topologia de deploy. Pronto: repetição recebe 429, limites não somem de forma insegura na topologia escolhida, mensagens não revelam existência de conta.
5. **P0 antes de cobrança real — T1 + Tech Lead: revisar dinheiro e dados.** Auditar acesso público, tenants, chave Pix, autenticidade/idempotência de webhook e confirmação de reservas. Dependência: decisões e provider real. Pronto: valores inteiros, duplicidade/concurrência testadas, nenhuma confirmação baseada no frontend, nenhum dado de outro tenant exposto.
6. **P1 — T1: endurecer produção.** HTTPS obrigatório, segredos fora do Git, logs sem links/tokens/email/chaves, SMTP com transporte seguro, backup e restauração comprovados. Dependência: infraestrutura real. Pronto: configuração validada e prova de restauração sem divulgar credenciais.
7. **Gate — T3 + Tech Lead:** executar testes de origem/callback, expiração/reuso, sessão/logout, tenant cruzado, rate limit, SMTP indisponível e webhook duplicado; executar lint/typecheck/test e build em sequência apropriada. Pronto: evidências reais anexadas e revisão sem BLOQUEIA. Nenhuma aprovação de produção baseada apenas nesta documentação.

## Pendências

- Diagnóstico completo do pedido válido e da conexão SMTP.
- Relatório independente do Tech Lead e consolidação dos achados.
- Configuração de entrega externa e topologia de produção; não inventar credenciais ou fornecedor.
- Nesta execução não houve correção de código, mudança de configuração, envio real, deploy ou execução da suíte completa.

## Revisão independente recebida

O Tech Lead classificou o recorte de autenticação como **MELHORAR**, sem vulnerabilidade crítica comprovada. Confirmou no código da biblioteca cookies HttpOnly/SameSite=Lax, rejeição de callback externo, expiração de 300 segundos e rate limit do magic link de 5 solicitações por 60 segundos quando o limitador está habilitado. Encontrou ausência de testes próprios de expiração, origem, callback externo e limite. A simulação do login de conversão deve ser removida do fluxo real. Revisão estática não prova entrega SMTP nem segurança completa de tenants/pagamentos; esses gates continuam pendentes.

Relatório fonte local: `.maestri/roles/b2fc8c28-cd52-468a-b8b8-3e531c43a124/AUDITORIA-AUTH.md`. Nenhum teste foi executado pelo revisor.
