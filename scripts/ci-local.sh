#!/usr/bin/env bash
# CI local: repete os jobs de .github/workflows/ci.yml na sua máquina, sem GitHub Actions.
#
# Uso:
#   scripts/ci-local.sh                 # tudo (exige docker/podman com Postgres 17)
#   scripts/ci-local.sh static          # lint, typecheck, test, build, bundles, audit
#   scripts/ci-local.sh db              # test:db contra Postgres descartável
#   scripts/ci-local.sh e2e             # Playwright (+ páginas legais)
#   scripts/ci-local.sh docker          # hadolint, build da imagem e smoke test
#   scripts/ci-local.sh motion-webkit   # motion no WebKit dentro da imagem oficial do Playwright
#   scripts/ci-local.sh visual          # regressão visual (landing e cadastro, 4 larguras, 2 temas), no container Ubuntu
#
# Cada etapa usa um Postgres 17 descartável com a mesma configuração do CI
# (trust, sem senha), na porta CI_PG_PORT (padrão 5433). Segredos são gerados
# a cada execução e nunca lidos de .env.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_PORT="${CI_PG_PORT:-5433}"
PG_NAME="agenda-ci-local-pg"
CONTAINER_BIN="${CONTAINER_BIN:-docker}"
PW_IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble"
PW_TAG="agendapix:ci-local"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mFALHOU: %s\033[0m\n' "$*" >&2; exit 1; }
restore_tsconfig() { git checkout -- tsconfig.json 2>/dev/null || true; }
trap restore_tsconfig EXIT

stage_static() {
  say "lint"; pnpm lint || die "lint"
  say "typecheck"; pnpm typecheck || die "typecheck"
  say "test (unitários)"; pnpm test || die "test"
  say "build"; pnpm build || die "build"
  say "build:bundles"; pnpm build:bundles || die "build:bundles"
  say "audit (prod, high)"; pnpm audit --prod --audit-level=high || die "audit"
}

start_pg() {
  local db="$1"
  "$CONTAINER_BIN" rm -f "$PG_NAME" >/dev/null 2>&1 || true
  "$CONTAINER_BIN" run -d --name "$PG_NAME" \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=agenda -e POSTGRES_DB="$db" \
    -p "127.0.0.1:${PG_PORT}:5432" postgres:17-alpine >/dev/null
  for _ in $(seq 1 60); do
    "$CONTAINER_BIN" exec "$PG_NAME" pg_isready -U agenda -d "$db" >/dev/null 2>&1 && return 0
    sleep 1
  done
  die "Postgres não ficou pronto"
}

stop_pg() { "$CONTAINER_BIN" rm -f "$PG_NAME" >/dev/null 2>&1 || true; }

stage_db() {
  say "Postgres 17 descartável (porta ${PG_PORT})"
  start_pg agenda
  trap 'stop_pg; restore_tsconfig' EXIT
  export DATABASE_URL="postgresql://agenda@127.0.0.1:${PG_PORT}/agenda"
  export BETTER_AUTH_URL=http://localhost:3000
  export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
  export FAKE_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  say "migrations (1ª vez)"; pnpm db:migrate || die "migrate"
  say "migrations (2ª vez, deve ser no-op)"; pnpm db:migrate || die "migrate idempotente"
  say "test:db"; pnpm test:db || die "test:db"
  stop_pg
}

stage_e2e() {
  say "Postgres 17 descartável para e2e (porta ${PG_PORT})"
  start_pg agenda
  trap 'stop_pg; restore_tsconfig' EXIT
  "$CONTAINER_BIN" exec "$PG_NAME" psql -U agenda -d agenda -qc "CREATE DATABASE agenda_e2e;"
  export DATABASE_URL="postgresql://agenda@127.0.0.1:${PG_PORT}/agenda_e2e"
  export BETTER_AUTH_URL=http://127.0.0.1:3344
  export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
  export FAKE_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  export PIX_KEY_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  export PAYMENT_PROVIDER=fake
  export CI=true
  say "migrations"; pnpm db:migrate || die "migrate e2e"
  say "playwright: suíte principal"; pnpm test:e2e || die "test:e2e"
  say "playwright: páginas legais"; pnpm exec playwright test --config=playwright.legal.config.ts || die "legal"
  stop_pg
}

stage_docker() {
  say "hadolint"
  "$CONTAINER_BIN" run --rm -i hadolint/hadolint < Dockerfile || die "hadolint"
  say "build da imagem"
  "$CONTAINER_BIN" build -t "$PW_TAG" . || die "docker build"
  say "postgres + mailpit"
  start_pg agenda
  "$CONTAINER_BIN" rm -f agenda-ci-local-mailpit >/dev/null 2>&1 || true
  "$CONTAINER_BIN" run -d --name agenda-ci-local-mailpit --network host -e MP_SMTP_LISTEN=0.0.0.0:1025 axllent/mailpit:v1.31 >/dev/null
  trap 'stop_pg; "$CONTAINER_BIN" rm -f agendapix agendapix-worker agenda-ci-local-mailpit >/dev/null 2>&1 || true; restore_tsconfig' EXIT
  local db_url="postgresql://agenda@127.0.0.1:${PG_PORT}/agenda"
  say "migrations da imagem (2x)"
  for _ in 1 2; do "$CONTAINER_BIN" run --rm --network host -e DATABASE_URL="$db_url" "$PW_TAG" node migrate.cjs; done
  say "subindo o app"
  "$CONTAINER_BIN" run -d --name agendapix --network host \
    -e PORT=3000 -e DATABASE_URL="$db_url" -e BETTER_AUTH_URL=http://localhost:3000 \
    -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
    -e SMTP_HOST=localhost -e SMTP_PORT=1025 -e SMTP_SECURE=false \
    -e "SMTP_FROM=AgendaPix <ci@agendapix.dev.br>" "$PW_TAG" >/dev/null
  for _ in $(seq 1 30); do curl -fsS http://localhost:3000/api/health >/dev/null 2>&1 && break; sleep 1; done
  say "smoke HTTP"
  curl -fsS http://localhost:3000/api/health | grep -q '"ok"' || die "health"
  test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)" = 200 || die "home"
  for p in /preview /preview/booking /preview/painel /preview/motion; do
    test "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$p")" = 404 || die "$p deveria ser 404 em produção"
  done
  test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/exemplo)" = 200 || die "/exemplo"
  test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/public/nao-existe/services)" = 404 || die "rota pública com banco"
  say "reconciliador (uma passagem e loop)"
  "$CONTAINER_BIN" run --rm --network host -e NODE_ENV=development -e DATABASE_URL="$db_url" \
    -e PAYMENT_PROVIDER=fake -e FAKE_WEBHOOK_SECRET="$(openssl rand -hex 32)" "$PW_TAG" node reconcile.mjs --once --json >/dev/null || die "reconcile --once"
  "$CONTAINER_BIN" run -d --name agendapix-worker --network host -e DATABASE_URL="$db_url" -e RECONCILE_INTERVAL_SECONDS=5 "$PW_TAG" node reconcile.mjs >/dev/null
  sleep 12
  "$CONTAINER_BIN" logs agendapix-worker 2>&1 | grep -q 'reconcile: loop' || die "worker sem loop"
  say "HEALTHCHECK"
  local status=""
  for _ in $(seq 1 45); do
    status="$("$CONTAINER_BIN" inspect --format '{{.State.Health.Status}}' agendapix)"
    [ "$status" = healthy ] && break
    sleep 2
  done
  [ "$status" = healthy ] || die "container não ficou healthy ($status)"
  "$CONTAINER_BIN" rm -f agendapix agendapix-worker agenda-ci-local-mailpit >/dev/null 2>&1 || true
  stop_pg
}

stage_visual() {
  # Os baselines são de Linux (fontes e antialiasing), então a comparação roda no mesmo container do CI.
  # Para atualizar os baselines depois de uma mudança visual intencional: scripts/ci-local.sh visual --update
  say "regressão visual (container Playwright Ubuntu)"
  start_pg agenda
  "$CONTAINER_BIN" exec "$PG_NAME" psql -U agenda -d agenda -qc "CREATE DATABASE agenda_e2e;" 2>/dev/null || true
  DATABASE_URL="postgresql://agenda@127.0.0.1:${PG_PORT}/agenda_e2e" pnpm db:migrate >/dev/null || { stop_pg; die "migrate do banco de e2e"; }
  local update=""
  [ "${2:-}" = "--update" ] && update="--update-snapshots"
  "$CONTAINER_BIN" run --rm --ipc=host --network host \
    -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e NEXT_TELEMETRY_DISABLED=1 -e CI=true \
    -e DATABASE_URL="postgresql://agenda@127.0.0.1:${PG_PORT}/agenda_e2e" \
    -e BETTER_AUTH_URL=http://127.0.0.1:3344 \
    -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
    -e FAKE_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
    -e PIX_KEY_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
    -e PAYMENT_PROVIDER=fake \
    -v "$PWD":/src:ro -v "$PWD/tests/e2e":/out "$PW_IMAGE" bash -lc \
    "set -e; mkdir -p /work && cd /src && tar --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./test-results --exclude=./playwright-report -cf - . | tar -xf - -C /work && cd /work && corepack enable pnpm && pnpm install --frozen-lockfile >/tmp/install.log 2>&1 && pnpm exec playwright test --config=playwright.visual.config.ts --project=desktop $update && if [ -n '$update' ]; then cp -r /work/tests/e2e/visual.spec.ts-snapshots /out/ && chown -R $(id -u):$(id -g) /out/visual.spec.ts-snapshots; fi" \
    || { stop_pg; die "regressão visual"; }
  stop_pg
}

stage_motion_webkit() {
  say "motion no WebKit (dentro da imagem oficial do Playwright)"
  "$CONTAINER_BIN" run --rm --ipc=host -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e NEXT_TELEMETRY_DISABLED=1 -e CI=true \
    -v "$PWD":/src:ro "$PW_IMAGE" bash -lc \
    'set -e; mkdir -p /work && cd /src && tar --exclude=./node_modules --exclude=./.next --exclude=./.git -cf - . | tar -xf - -C /work && cd /work && corepack enable pnpm && pnpm install --frozen-lockfile >/tmp/install.log 2>&1 && pnpm exec playwright test --config=playwright.motion.config.ts --project=webkit' \
    || die "motion webkit"
}

stage="${1:-all}"
shift || true
case "$stage" in
  static) stage_static ;;
  db) stage_db ;;
  e2e) stage_e2e ;;
  docker) stage_docker ;;
  motion-webkit) stage_motion_webkit ;;
  visual) stage_visual "$stage" "${1:-}" ;;
  all)
    stage_static
    stage_db
    stage_e2e
    stage_docker
    stage_motion_webkit
    stage_visual
    ;;
  *) die "etapa desconhecida: $stage" ;;
esac

say "CI local: tudo verde (${stage})"
