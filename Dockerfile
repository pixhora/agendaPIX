# syntax=docker/dockerfile:1.7
#
# Imagem de produção do agendaPIX: um único app Next.js em output standalone.
#
#   docker build -t agendapix .
#   docker run --rm --env-file .env.production agendapix node migrate.cjs   # migrations (uma transação por arquivo)
#   docker run -d --env-file .env.production -p 127.0.0.1:3000:3000 agendapix
#   docker run -d --env-file .env.production agendapix node reconcile.mjs   # worker de reconciliação (loop)
#
# Nenhum segredo entra na imagem: todas as variáveis são lidas em runtime.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- base: Node 22 + pnpm via corepack (versão fixada em package.json#packageManager)
FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm
WORKDIR /app

# ---- deps: instala dependências a partir do lockfile (camada cacheável)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# ---- build: next build (standalone) + entrypoints de processo empacotados (migrate, reconcile)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build \
 && pnpm build:bundles \
 && mkdir -p public

# ---- runner: só o necessário para executar, usuário não-root
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Servidor standalone (inclui apenas os node_modules rastreados pelo Next) + assets estáticos.
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
# Processos auxiliares autocontidos: migrate.cjs (sempre) e reconcile.mjs (quando o backend o tiver) + SQL versionado.
COPY --from=build --chown=1000:1000 /app/dist/ ./
COPY --from=build --chown=1000:1000 /app/db/migrations ./db/migrations

# Usuário "node" (uid/gid 1000) já existe na imagem oficial; numérico para runtimes que exigem runAsNonRoot.
USER 1000:1000
EXPOSE 3000

# /api/health verifica apenas o processo HTTP (não o banco nem o SMTP).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "server.js"]
