# Архитектура

## Слои

Feature-sliced структура с чистым доменным слоем. Направление зависимостей
проверяется линтером (`eslint-plugin-boundaries`, см. `eslint.config.mjs`).

```
src/
├── app/                   # Next.js App Router: маршруты и UI-композиция.
│   └── api/**/route.ts    # Тонкие handlers: parse → Zod → use-case → HTTP
├── modules/
│   ├── game/
│   │   ├── domain/        # Чистые функции и типы. Не знает про Next/Prisma/HTTP
│   │   ├── application/   # Use-cases + порты (интерфейсы). Возвращают Result<T,E>
│   │   ├── infrastructure/# Реализации портов: Prisma-репозитории, шина событий
│   │   ├── presentation/  # React-компоненты фичи + DTO-мапперы
│   │   ├── schemas.ts     # Zod DTO (общие для клиента и сервера)
│   │   ├── composition.ts # Composition root: связывает use-cases с адаптерами
│   │   └── lazy-sweep.ts  # Фоновая уборка при чтениях
│   ├── weather/           # Та же структура: порт → Open-Meteo + PG-кэш
│   └── reliability/       # Домен индекса надёжности
├── shared/
│   ├── lib/               # env (Zod, fail-fast), db, redis, logger, result, format
│   ├── security/          # rate limiter, токены (HMAC), honeypot/time-trap, guard
│   ├── errors/            # Единый формат ответов API, маппинг DomainError → HTTP
│   ├── hooks/             # useGameEvents (SSE), useHostToken
│   └── ui/                # shadcn/ui компоненты
├── i18n/                  # next-intl (ru default, en заготовка, без локали в URL)
└── proxy.ts               # security headers, request-id (бывший middleware)
```

## Ключевые решения

### Идентификация без регистрации

- Участник: анонимный токен в httpOnly-cookie (`kickoff_pid`), в БД — только
  HMAC-SHA256-хеш. Один и тот же cookie служит идентичностью и для лимита
  «не больше 2 активных игр на организатора».
- Организатор: отдельный секретный токен на игру, показывается один раз,
  хранится в localStorage браузера, передаётся заголовком `x-host-token`.
  Проверка — сравнение за константное время. Почему HMAC, а не argon2 —
  см. ADR-0002.

### Конкурентный join (ТЗ §6)

`SELECT … FOR UPDATE` на строке игры внутри interactive-транзакции
(`PrismaUnitOfWork.withGameLock`). Все мутации состава (join, leave,
промоушен из waitlist, правка команд) сериализуются на одном локе,
поэтому превысить `maxPlayers` невозможно — подтверждено интеграционным
тестом гонки (10 параллельных join на 1 место). Почему не Serializable —
см. ADR-0004.

### Live-обновления (SSE)

`EventBus` порт: in-process `EventEmitter` по умолчанию, Redis pub/sub —
автоматически при `REDIS_URL` (для >1 реплики). События «тонкие»
(notify-then-fetch): клиент на любое событие инвалидирует TanStack Query —
это снимает проблемы Last-Event-ID и replay. Подробности — ADR-0003.

### Rate limiting (ТЗ §3)

Sliding window: Redis (ZSET + Lua, атомарно) → PostgreSQL-fallback
(`rate_limit_events`) → политика отказа на точке вызова: `closed` для
создания игр (недоступность хранилища = запрет), `open` для общего
write-лимита (иначе отказ БД равен полному отказу сервиса).

### Фоновая уборка

`CANCELLED_NOT_ENOUGH` / `FINISHED` проставляет `closeExpiredGames`:

- lazy-sweep при чтениях ленты/игры (не чаще раза в минуту на инстанс) —
  основной механизм, внешний cron некритичен;
- POST `/api/cron/close-expired` (заголовок `x-cron-secret`) — точный тик
  раз в 10 минут из GitHub Actions или отдельного Railway-сервиса (ADR-0005).

### Деньги и время

Деньги — только целые (минимальные единицы валюты). Все DateTime — UTC;
IANA-таймзона игры хранится отдельно и используется при рендере.

## Данные

Схема — `prisma/schema.prisma` (Prisma 7, driver adapter `@prisma/adapter-pg`).
Сущности: Game, Participant (уникальность никнейма в игре, waitlistOrder),
ParticipantProfile (reliability, ключ — хеш токена, живёт дольше игры),
RateLimitEvent (fallback лимитера), AuditLog, WeatherCache.
