# Rodar o agendaPIX no Windows 11

Este guia parte do backup feito por `scripts/backup-project.sh`. Ele cobre instalar as ferramentas, restaurar o projeto e subir o ambiente de desenvolvimento.

Os comandos abaixo rodam no **PowerShell** (menu Iniciar → "Windows PowerShell"). Quando indicado, use o **Git Bash** (vem com o Git for Windows).

## 1. Instalar as ferramentas

Abra o PowerShell como usuário comum e rode:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
winget install --id GitHub.cli -e
```

Feche e abra o PowerShell de novo, para o `PATH` atualizar. Depois confira as versões (Node precisa ser 22.16 ou mais novo):

```powershell
git --version
node --version
docker --version
gh --version
```

Ative o pnpm na versão do projeto (`pnpm@12.8.1`, definida no `package.json`):

```powershell
corepack enable
corepack prepare pnpm@12.8.1 --activate
pnpm --version
```

Se o `corepack enable` falhar por falta de permissão, abra o PowerShell **como administrador** e rode de novo.

Configure o Git para não converter quebras de linha (evita diferenças falsas em todos os arquivos):

```powershell
git config --global core.autocrlf input
git config --global init.defaultBranch master
```

Abra o **Docker Desktop** pelo menu Iniciar e espere aparecer "Engine running" antes de seguir.

Por último, faça login no GitHub (você escolhe o método no terminal):

```powershell
gh auth login
```

## 2. Restaurar o projeto a partir do backup

Copie a pasta do backup (`agendapix-AAAA-MM-DD_HHMM`) para o computador novo, por exemplo `C:\Backup\`. Confira as somas no PowerShell:

```powershell
cd C:\Backup\agendapix-AAAA-MM-DD_HHMM
Get-FileHash agendapix-code.tar.gz, agendapix-git.bundle, secrets.tar.gz.enc -Algorithm SHA256
```

Compare com o arquivo `SHA256SUMS` da mesma pasta. Os valores têm que bater.

Crie a pasta de trabalho e clone o histórico a partir do bundle:

```powershell
mkdir C:\Dev -Force
cd C:\Dev
git clone C:\Backup\agendapix-AAAA-MM-DD_HHMM\agendapix-git.bundle agendaPIX
cd agendaPIX
git remote set-url origin https://github.com/pixhora/agendaPIX.git
git checkout master
```

Extraia o código do backup por cima da pasta clonada. Ele tem o mesmo conteúdo do histórico, mas inclui alterações que não foram commitadas:

```powershell
tar -xzf C:\Backup\agendapix-AAAA-MM-DD_HHMM\agendapix-code.tar.gz --exclude=.git
```

Restaure os segredos (`.env`, `.env.local`). Use o **Git Bash** para isso, porque o `openssl` vem com o Git for Windows. Quando pedir, digite a senha que você anotou no gerenciador de senhas:

```bash
cd /c/Dev/agendaPIX
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in /c/Backup/agendapix-AAAA-MM-DD_HHMM/secrets.tar.gz.enc | tar -xzf -
ls -la .env .env.local
```

Não coloque esses arquivos em nenhum lugar público nem os envie por chat.

## 3. Instalar dependências e rodar

No PowerShell, dentro de `C:\Dev\agendaPIX`:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Suba o Postgres local (precisa do Docker Desktop aberto):

```powershell
docker compose up -d postgres
```

Aplique as migrations no banco local e rode o app:

```powershell
pnpm db:migrate
pnpm dev
```

Abra `http://localhost:3000` no navegador.

Para checar a qualidade antes de publicar, rode:

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

## 4. CI local (scripts em bash)

Os scripts `scripts/ci-local.sh` e `scripts/backup-project.sh` são bash. No Windows, rode-os pelo **Git Bash**, dentro da pasta do projeto, com o Docker Desktop aberto:

```bash
cd /c/Dev/agendaPIX
bash scripts/ci-local.sh static
bash scripts/ci-local.sh db
```

Para o backup no próprio Windows, use o Git Bash:

```bash
bash scripts/backup-project.sh /c/Backup/novo-backup
```

## 5. Publicar em produção

O deploy é feito com a Vercel CLI, via `npx`. Na primeira vez, faça login:

```powershell
npx vercel login
npx vercel link
```

Depois, para publicar (só com o seu aval):

```powershell
npx vercel --prod --yes
```

Os segredos de produção (Neon, Mercado Pago, Blob, e-mail) continuam nas variáveis da Vercel. Não precisam ir para o computador novo.

## 6. Dicas e armadilhas

- **Caminhos com espaço ou acento** atrapalham os scripts. Mantenha o projeto em `C:\Dev\agendaPIX`.
- **Antivírus e Windows Defender** podem deixar o `pnpm install` muito lento. Se isso acontecer, exclua a pasta `C:\Dev\agendaPIX` da análise em tempo real.
- **Arquivos `.sh`** precisam continuar com quebras de linha LF. Se o Git reclamar, confira `git config core.autocrlf` (deve ser `input`).
- **Dados de produção** não estão neste backup. Eles ficam no Neon (branch `production`) e podem ser restaurados ou exportados pelo console do Neon.
- **Claude Code** no Windows: instale pela documentação oficial da Anthropic. Depois, copie as memórias do projeto se quiser manter o contexto.
