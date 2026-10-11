# CI local (rígido)

Roda sem o GitHub Actions. Comando: `scripts/ci-local.sh` (tudo) ou uma etapa por vez.

| Etapa | O que faz | Falha quando |
|---|---|---|
| `pr` | regras de PR contra `origin/master` (`scripts/check-pr.mjs`) | branch atrás da master; conflito; migration com número repetido ou que não é maior que a da master; journal fora de ordem (`when` que não cresce); migration nova sem snapshot; `package.json` sem lockfile; segredo no diff; `console.log`, `debugger` ou `.only` esquecidos; `TODO` sem dono |
| `static` | lint (zero warnings), typecheck, testes unitários, build, bundles, audit | qualquer um deles |
| `db` | migrations duas vezes (a segunda não pode mudar nada) e testes de integração | qualquer um deles |
| `e2e` | Playwright (suíte principal e páginas legais) | qualquer teste falha |
| `docker` | hadolint, build da imagem, smoke test e reconciliador | qualquer passo |
| `motion-webkit` | animações no WebKit | qualquer teste falha |
| `visual` | regressão visual no container Ubuntu (`--update` para atualizar) | diferença acima do limite |

## Regras de PR (`pr`)

- **Branch atualizada:** o PR precisa conter a `origin/master` atual. Faça `git rebase origin/master`.
- **Migrations:** cada número é único. Migrations novas têm número maior que o da master. O `_journal.json` tem `idx` em sequência e `when` crescente. Toda migration nova tem o snapshot correspondente.
- **Lockfile:** se `package.json` mudou, `pnpm-lock.yaml` também precisa mudar.
- **Segredos:** nenhuma URL de banco com senha fora de `localhost`, nem chaves de produção (Stripe, Mercado Pago), nem chave privada. Exemplos de configuração usam `<placeholder>`, nunca uma senha.
- **Código limpo:** sem `console.log`, `debugger` ou `.only` nos arquivos de aplicação e testes. `TODO` precisa de dono: `TODO(nome)`.

## Quando uma regra estiver errada

Não desligue a regra no código. Corrija o PR ou, se a regra estiver errada de fato, abra um PR que altere `scripts/check-pr.mjs` e explique o motivo na descrição.
