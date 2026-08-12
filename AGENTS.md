<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kickoff — платформа сбора на футбол

Next.js 16 + Prisma 7 (driver adapter pg, клиент генерируется в
`src/generated/prisma`) + PostgreSQL. Полное описание архитектуры —
`docs/ARCHITECTURE.md`, контракт API — `docs/API.md`, решения — `docs/ADR/`.

## Что важно знать

- **Слои**: `src/modules/*/domain` (чистые функции) ← `application`
  (use-cases + порты, всё через `Result<T,E>`) ← `infrastructure`
  (Prisma/Redis) и `presentation` (React). Границы проверяет
  eslint-plugin-boundaries — `npm run lint` покажет нарушение.
- **Мутации состава игры** — только внутри `PrismaUnitOfWork.withGameLock`
  (SELECT FOR UPDATE). Не обходить, иначе гонка на maxPlayers.
- **Все строки UI** — через next-intl (`messages/ru.json` + en).
- **Локальная БД** (Windows, без Docker): портативный PostgreSQL на порту
  5433 — `npm run db:start` / `db:stop`; портативный Node в `.tools/node`.
- **Проверки перед коммитом**: `npm run lint && npm run typecheck &&
npm run test` (husky прогоняет lint-staged + commitlint, Conventional Commits).
- **Integration/e2e** ходят в реальные базы `kickoff_test` / `kickoff_e2e`
  (см. `.env`); e2e требует `npm run build` перед `npm run e2e`.
- Секреты только через ENV (`src/shared/lib/env.ts`, Zod, fail-fast).
  `TOKEN_PEPPER` менять нельзя — инвалидирует все токены.
