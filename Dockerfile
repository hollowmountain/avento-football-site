# syntax=docker/dockerfile:1
# Multi-stage сборка для Railway (и любого Docker-хостинга).
# Prisma 7 без Rust-движков — alpine работает без OpenSSL-обвязки.

FROM node:22-alpine AS base

# ---------- Зависимости ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: prisma generate и husky выполняются явно в builder-стадии
RUN npm ci --ignore-scripts

# ---------- Сборка ----------
FROM base AS builder
WORKDIR /app
# Значения объявлены ДО prisma generate: .env в образ не попадает
# (см. .dockerignore), а prisma.config.ts читает DATABASE_URL через env()
# и падает без него — как и env.ts при next build. Реальные секреты
# приходят только в runtime из окружения Railway.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    TOKEN_PEPPER="build-time-pepper-0000000000" \
    IP_HASH_SALT="build-time-salt-000000000000" \
    CRON_SECRET="build-time-secret-0000000000" \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- CLI миграций ----------
# Отдельное дерево вместо копирования пакетов поимённо: CLI тянет с десяток
# транзитивных зависимостей (c12, jiti, effect…), которые npm поднимает в
# корень node_modules, и точечный список ломался бы при каждом обновлении.
FROM base AS migrator
WORKDIR /migrator
COPY package.json ./
# Версию берём из package.json, чтобы CLI миграций не разъезжался со схемой
RUN PRISMA_SPEC=$(node -p 'require("./package.json").devDependencies.prisma') \
 && npm install --no-save "prisma@$PRISMA_SPEC"

# ---------- Runtime ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Дерево CLI миграций — именно в /app/node_modules: prisma.config.ts
# импортирует 'prisma/config', а модули резолвятся относительно /app.
# Кладём первым, чтобы при совпадении пакетов верх взял трейс standalone.
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./node_modules

# standalone-бандл + статика (standalone не включает их сам)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Схема и конфиг для `migrate deploy` на старте (standalone их не трейсит).
# dotenv в зависимости prisma не входит, а prisma.config.ts начинается
# с `import 'dotenv/config'` — копируем отдельно.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv

USER nextjs
EXPOSE 3000

# Миграции — в release-фазе старта, не в build (ТЗ §10)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
