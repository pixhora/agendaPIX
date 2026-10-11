#!/usr/bin/env bash
# Backup do projeto agendaPIX para trocar de computador (ex.: Linux -> Windows 11).
#
# Gera, em DESTINO (padrão: ~/backups/agendapix-AAAA-MM-DD_HHMM/):
#   1. agendapix-code.tar.gz   código e arquivos do projeto (sem node_modules, builds e caches)
#   2. agendapix-git.bundle    histórico git completo, todas as branches e tags
#   3. secrets.tar.gz.enc      .env e .env.* criptografados (AES-256, pede uma senha)
#   4. SHA256SUMS              somas de verificação
#
# Não inclui: node_modules, .next, dist, test-results, playwright-report (recriados com pnpm install).
# Não inclui: dados de produção. Eles ficam no Neon (branch production) e no Vercel.
#
# Uso:
#   scripts/backup-project.sh [DESTINO]
#   BACKUP_PASSPHRASE='...' scripts/backup-project.sh     (sem pedir a senha; use só em script)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="${1:-$HOME/backups/agendapix-$STAMP}"

say() { printf '\n== %s\n' "$*"; }

mkdir -p "$DEST"
cd "$REPO"

say "Código (tar.gz)"
tar -czf "$DEST/agendapix-code.tar.gz" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.next-legal' \
  --exclude='./dist' \
  --exclude='./test-results' \
  --exclude='./playwright-report' \
  --exclude='./.git' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  .

say "Histórico git (bundle com todas as branches)"
git bundle create "$DEST/agendapix-git.bundle" --all
git bundle verify "$DEST/agendapix-git.bundle" >/dev/null

say "Segredos (.env e .env.*), criptografados"
SECRET_FILES=()
for f in .env .env.*; do
  [ -f "$f" ] && SECRET_FILES+=("$f")
done
if [ "${#SECRET_FILES[@]}" -gt 0 ]; then
  tar -czf - "${SECRET_FILES[@]}" | {
    if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
      openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$DEST/secrets.tar.gz.enc"
    else
      openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -out "$DEST/secrets.tar.gz.enc"
    fi
  }
  echo "Arquivos de segredo incluídos: ${SECRET_FILES[*]}"
else
  echo "Nenhum .env encontrado; nada de segredo foi salvo."
fi

say "Referência (estado do git no momento do backup)"
{
  echo "branch atual: $(git branch --show-current)"
  echo "último commit: $(git log -1 --format='%H %s')"
  echo "alterações não commitadas:"
  git status --short || true
} > "$DEST/estado-git.txt"

say "Somas de verificação"
(cd "$DEST" && sha256sum agendapix-code.tar.gz agendapix-git.bundle $( [ -f secrets.tar.gz.enc ] && echo secrets.tar.gz.enc ) > SHA256SUMS)

say "Pronto"
ls -lh "$DEST"
echo
echo "Guarde a pasta em dois lugares (pendrive, HD externo ou nuvem) e anote a senha do arquivo secrets.tar.gz.enc num gerenciador de senhas."
