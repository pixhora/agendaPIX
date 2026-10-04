# T2-A — Login do painel alinhado aos tokens T4-A

## Direção validada

Protótipo descartável comparou três composições: A, cabeçalho da marca com formulário compacto central; B, coluna de boas-vindas e login lado a lado; C, formulário aberto com separador editorial. A serve melhor entrada rápida por e-mail no mobile; B reduz a área útil; C perde contraste entre marca, instrução e ação. A manteve cabeçalho/logo, chamada e formulário existentes. Nenhuma UI de Trilha foi duplicada.

## Implementação

`components/dashboard/login-form.module.css` usa valores publicados em538f6a3: superfície #fff, fundo #f5f6f2, foreground #111613, lime #c0f739, forest #0f3b2e, Plus Jakarta para títulos e Inter para corpo. Tokens com fallback permitem preview local sem copiar ou alterar `app/globals.css`/componentes compartilhados. Tema escuro responde a preferência do sistema e classes `.dark`/`.light` explícitas. Mantidos controles48px, contraste/anel de foco, hierarquia e copy atuais.

Nenhuma mudança de auth: magic link continua na autoridade3000, callback absoluto `http://localhost:3343/dashboard`, erro `http://localhost:3343/dashboard/login?error=link`; pending/error/success e foco existentes preservados. Não simulei entrega de e-mail.

## Provas

- `pnpm lint`:exit0.
- `pnpm typecheck`:exit0.
- `pnpm test`:79/79.
- `pnpm build`: Next16.3.8 production build concluído, tipos/rotas gerados.
- `pnpm exec playwright test --config tests/dashboard-login.config.ts`:8/8 contra rota real `/dashboard/login` em3343;375/390/1280, tema claro/escuro, HTML class `.light`/`.dark`, CTA/input/fontes/overflow/teclado, pending/success/error e callback absoluto. Envio foi interceptado; não prova SMTP ou sessão.
- Capturas antes de chamada externa: `docs/evidencias/dashboard-login/login-{375,1280}-{light,dark}.png`.

Protótipo descartável: `/tmp/agenda-login-prototype.html`; somente referência da decisão, sem código de produção/dependências.

## Árvore e pendências

T2-A implementado. Revisão independente aguarda terminal designado; usuário revisou T2-B/T2-C, não este delta. Testes de UI/mock não substituem prova de SMTP real. Mudanças anteriores em docs/progresso/backlog e relatórios/evidências de auditoria foram lidas e preservadas; este commit registra adendo focal de T2-A sem reescrever as notas.
