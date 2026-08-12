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
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Фиктивные значения для сборки: env.ts валидирует наличие переменных,
# реальные секреты придут только в runtime из окружения Railway
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    TOKEN_PEPPER="build-time-pepper-0000000000" \
    IP_HASH_SALT="build-time-salt-000000000000" \
    CRON_SECRET="build-time-secret-0000000000" \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Runtime ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# standalone-бандл + статика (standalone не включает их сам)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI для `migrate deploy` на старте (standalone его не трейсит)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

USER nextjs
EXPOSE 3000

# Миграции — в release-фазе старта, не в build (ТЗ §10)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
