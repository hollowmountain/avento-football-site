# ⚽ Kickoff — сбор на футбол без регистрации

Организатор создаёт игру и получает ссылку-приглашение с коротким кодом
(`KCK-7F2A`). Игроки открывают ссылку, вводят имя и никнейм — и они в составе.
Никаких аккаунтов: участники узнаются по анонимному httpOnly-cookie,
организатор управляет игрой по секретному токену.

## Возможности

- **Создание игры без регистрации**: дата, место, формат (5×5…11×11),
  максимум игроков, стоимость, уровень, дедлайн отмены.
- **Лист ожидания**: мест нет — вы в очереди; кто-то отказался — первый из
  очереди автоматически поднимается в состав.
- **Live-обновления** состава через Server-Sent Events — без перезагрузки.
- **Авто-жеребьёвка команд** с балансом по позициям и уровню (snake draft)
  - ручное перетаскивание игроков (drag-and-drop).
- **Порог жизнеспособности**: не набрали минимум к дедлайну — игра
  автоматически отменяется, прогресс-бар показывает «нужно ещё N».
- **Погода на время игры** (Open-Meteo, кэш 1 час): «дождь ☔ — возьмите вторые бутсы».
- **Экспорт в календарь** (.ics) и **QR-код** игры.
- **Индекс надёжности**: ⭐ 92% / 🆕 новичок — поздние отказы видны всем.
- **Сплит стоимости**: «сейчас по 480 ₽ с человека», пересчёт в реальном времени.
- **Публичная лента** с фильтрами (город, формат, уровень, свободные места)
  и сортировками «скоро начнётся» / «мало мест».
- **Anti-abuse**: многослойный rate limiting (Redis + PostgreSQL-fallback,
  fail-closed), honeypot, time-trap, гео-дедупликация, Cloudflare Turnstile (флаг).

## Стек

Next.js 16 (App Router, React 19) · TypeScript strict · Tailwind CSS 4 +
shadcn/ui (Radix) · PostgreSQL 16 + Prisma 7 (driver adapters, без Rust-движков) ·
Redis (опционально) · Zod · TanStack Query · Pino · Vitest · Playwright ·
GitHub Actions · Docker/Railway.

Архитектура — модульная со слоями domain / application / infrastructure /
presentation (границы проверяет `eslint-plugin-boundaries`), подробнее в
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Контракт API — в
[docs/API.md](docs/API.md). Отклонения от исходного ТЗ — в
[docs/ADR](docs/ADR) и [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Локальный запуск

Требуется Node.js 22+.

### Вариант А: Docker

```bash
docker compose up -d          # PostgreSQL 16 + Redis 7
npm ci
cp .env.example .env          # DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
npx prisma migrate dev
npm run db:seed               # демо-игры (печатает host-токены)
npm run dev
```

### Вариант Б: без Docker (Windows, портативный PostgreSQL)

Так проект разрабатывался. Redis не нужен: rate limiting и кэш погоды
работают через PostgreSQL-fallback.

1. Скачайте [PostgreSQL binaries ZIP](https://www.enterprisedb.com/download-postgresql-binaries)
   и распакуйте в `.tools/pgsql` (папка в .gitignore).
2. Инициализируйте кластер (обязательно UTF-8!) и создайте базы:

```bash
.tools/pgsql/bin/initdb -D .local/pgdata -U postgres -E UTF8 --locale=C -A trust
powershell -File scripts/db.ps1 start
.tools/pgsql/bin/createdb -p 5433 -U postgres kickoff_dev
.tools/pgsql/bin/createdb -p 5433 -U postgres kickoff_test
.tools/pgsql/bin/createdb -p 5433 -U postgres kickoff_e2e
```

3. `.env` уже смотрит на порт 5433 (см. `.env.example`). Дальше:

```bash
npm ci
npx prisma migrate dev
npm run db:seed
npm run dev
```

Управление базой: `npm run db:start` / `npm run db:stop`.

## Тесты

```bash
npm run test:unit          # домен: жеребьёвка, цены, статусы, reliability
npm run test:integration   # против реального PostgreSQL, включая тест гонки
                           # (10 параллельных join на 1 место)
npm run build && npm run e2e   # Playwright на продакшен-билде
```

Один раз перед e2e: `npx playwright install chromium`.

## Деплой на Railway

1. Запушьте репозиторий на GitHub.
2. В [Railway](https://railway.app): **New Project → Deploy from GitHub repo**.
   Railway увидит `Dockerfile` и `railway.json` сам.
3. Добавьте в проект **PostgreSQL** (Add Service → Database → PostgreSQL).
   В сервисе приложения задайте переменную:
   `DATABASE_URL = ${{Postgres.DATABASE_URL}}?sslmode=require&connection_limit=5`
4. (Опционально) добавьте **Redis** и задайте `REDIS_URL = ${{Redis.REDIS_URL}}` —
   rate limiting станет быстрее, но и без него всё работает (PG-fallback).
5. Задайте секреты (сгенерируйте: `openssl rand -base64 32`):
   - `TOKEN_PEPPER` — **не меняйте после запуска**: инвалидирует все токены;
   - `IP_HASH_SALT`;
   - `CRON_SECRET`;
   - `APP_URL` — публичный URL сервиса (например `https://kickoff.up.railway.app`);
   - при желании `DEFAULT_CITY`, `DEFAULT_TIMEZONE`, `DEFAULT_CURRENCY`.
6. Деплой: старт-команда из Dockerfile сама выполнит `prisma migrate deploy`,
   healthcheck — `/api/health`.
7. **Cron** (закрытие просроченных игр каждые 10 минут). Приложение и без него
   прибирается само при просмотрах (lazy-sweep), но для точности включите один
   из вариантов:
   - GitHub Actions (готово в `.github/workflows/cron.yml`): в настройках
     репозитория задайте variable `APP_URL` и secret `CRON_SECRET`;
   - или отдельный Railway-сервис из того же репо с Cron Schedule `*/10 * * * *`
     и start-командой
     `sh -c 'curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" $APP_URL/api/cron/close-expired'`.

### Чеклист перед первым релизом

- [ ] `TOKEN_PEPPER`, `IP_HASH_SALT`, `CRON_SECRET` — уникальные случайные строки
- [ ] `APP_URL` совпадает с публичным доменом (ссылки, ICS, OG-картинки)
- [ ] `DATABASE_URL` содержит `sslmode=require` и `connection_limit`
- [ ] `/api/health` отвечает `{"ok":true,...}`
- [ ] Открывается лента, создаётся игра, срабатывает вступление по ссылке
- [ ] Превью ссылки (OG-картинка) рендерится: `<APP_URL>/games/<код>/opengraph-image…`
- [ ] Настроен cron-триггер (или осознанно оставлен только lazy-sweep)

### Если первый деплой упал

- **Healthcheck timeout** — почти всегда `DATABASE_URL`: проверьте referenced-переменную
  Postgres-сервиса и `sslmode=require`.
- **`prisma migrate deploy` падает** — база недоступна из сервиса (private networking)
  или в URL нет базы `railway`.
- **Ошибка про TOKEN_PEPPER/IP_HASH_SALT/CRON_SECRET** — не заданы переменные
  (env-валидация падает специально, см. `src/shared/lib/env.ts`).
- **Страницы 500, а health зелёный** — смотрите Deploy Logs: JSON-логи Pino
  содержат `requestId` для сопоставления с заголовком ответа `x-request-id`.
- **OG-картинка 500** — проверьте, что деплой шёл через Dockerfile (шрифты
  копируются стадией builder в standalone-трейс).

## Переменные окружения

Полный список с комментариями — в [.env.example](.env.example). Обязательные:
`DATABASE_URL`, `TOKEN_PEPPER`, `IP_HASH_SALT`, `CRON_SECRET`. Всё остальное
имеет дефолты; `REDIS_URL` опционален по дизайну.
