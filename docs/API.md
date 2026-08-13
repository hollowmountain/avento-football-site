# API

Единый формат ответа:

```jsonc
// успех
{ "ok": true, "data": { /* ... */ } }
// ошибка
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "…", "details": { /* опц. */ } } }
```

Аутентификация:

- участник — httpOnly-cookie `kickoff_pid` (выдаётся автоматически);
- организатор — заголовок `x-host-token` (выдаётся при создании игры);
- cron — заголовок `x-cron-secret`.

Anti-abuse: мутирующие формы требуют `formToken` (`{ts, sig}` — выдаёт
сервер при рендере страницы) и содержат honeypot-поле `website`
(должно быть пустым). Превышение лимитов → `429` + `Retry-After`.

## Эндпоинты

### POST /api/games — создать игру

```jsonc
// запрос
{
  "title": "Вечерний футбол",
  "description": "",
  "format": "FREE",                 // FREE|FIVE|SIX|SEVEN|EIGHT|ELEVEN_A_SIDE
  "skillLevel": "ANY",              // ANY|BEGINNER|INTERMEDIATE|ADVANCED
  "startsAt": "2026-08-14T16:00:00.000Z",
  "durationMinutes": 90,
  "timezone": "Europe/Moscow",
  "minPlayers": 6,
  "maxPlayers": 10,
  "pricePerPitch": 600000,          // копейки, целое
  "currency": "RUB",
  "cancelDeadline": "2026-08-14T10:00:00.000Z",
  "venueName": "Манеж",
  "address": "Ленинградский пр-т, 36",
  "latitude": 55.7912,
  "longitude": 37.559,
  "city": "Москва",
  "hostName": "Андрей",
  "formToken": { "ts": "…", "sig": "…" },
  "website": ""
}
// 201
{ "ok": true, "data": { "game": { "code": "AVA-7F2A", /* GameDto */ }, "hostToken": "…показывается один раз…" } }
```

Ошибки: `400 BAD_REQUEST|FORM_REJECTED|VALIDATION_FAILED|CAPTCHA_FAILED`,
`409 DUPLICATE_GAME`, `429 RATE_LIMITED|HOST_GAME_LIMIT`.

### GET /api/games — лента

Query: `city`, `format`, `skillLevel`, `hasFreeSlots=true`, `dateFrom`,
`dateTo`, `sort=soonest|few_slots`, `cursor`, `limit≤50`.

```jsonc
{ "ok": true, "data": { "items": [/* GameSummaryDto */], "nextCursor": "…| null" } }
```

### GET /api/games/:code — игра

```jsonc
{
  "ok": true,
  "data": {
    "game": {
      "code": "…",
      "status": "OPEN",
      "mainCount": 7,
      "freeSlots": 3,
      "needMore": 0,
      "perPersonPrice": 85715 /* … */,
    },
    "participants": [
      {
        "nickname": "…",
        "position": "…",
        "role": "MAIN",
        "reliability": { "kind": "score", "percent": 92 },
        "isYou": false /* … */,
      },
    ],
    "waitlist": [/* … */],
    "viewer": { "isHost": false, "isParticipant": true },
  },
}
```

### PATCH /api/games/:code — редактирование (host)

Заголовок `x-host-token`. Тело — частичный GameDto (title, startsAt,
maxPlayers и т.д.). Увеличение `maxPlayers` автоматически поднимает
игроков из листа ожидания. Ошибки: `403 FORBIDDEN`, `409 GAME_NOT_EDITABLE`,
`400 VALIDATION_FAILED`.

### DELETE /api/games/:code — отмена (host)

`{ "ok": true, "data": { "cancelled": true } }`

### POST /api/games/:code/participants — «Я иду»

```jsonc
// запрос
{ "name": "Александр", "nickname": "Санёк", "position": "GOALKEEPER",
  "skillLevel": "INTERMEDIATE", "attendance": "CONFIRMED",
  "formToken": { "ts": "…", "sig": "…" }, "website": "" }
// 201 — role: MAIN или WAITLIST (+waitlistOrder)
{ "ok": true, "data": { "participant": { /* ParticipantDto */ } } }
```

Ошибки: `409 NICKNAME_TAKEN|ALREADY_JOINED|GAME_NOT_JOINABLE`, `404 GAME_NOT_FOUND`.

### DELETE /api/games/:code/participants/me — отказ (по cookie)

```jsonc
{ "ok": true, "data": { "wasLateCancel": false, "promotedNickname": "Санёк" } }
```

### POST /api/games/:code/teams/shuffle — жеребьёвка (host)

`{ "ok": true, "data": { "teams": { "seed": 123, "teamA": [...], "teamB": [...] } } }`
Ошибка `409 NOT_ENOUGH_PLAYERS` — меньше двух подтверждённых.

### PUT /api/games/:code/teams — ручная правка составов (host)

Тело: `{ "teamA": ["participantId", …], "teamB": […] }`. Валидация: только
активные основные игроки, без дублей.

### GET /api/games/:code/stream — SSE

События: `participants_changed`, `game_updated`, `teams_shuffled`,
`game_cancelled`. Данные «тонкие» — по событию перезапросите GET игры.

### GET /api/games/:code/ics — файл календаря

### GET /api/games/:code/weather — погода на время игры

```jsonc
{
  "ok": true,
  "data": {
    "available": true,
    "temperatureC": 14,
    "precipitationProbability": 18,
    "isWet": false,
    "emoji": "🌤️",
  },
}
```

### POST /api/cron/close-expired — обслуживание (x-cron-secret)

```jsonc
{ "ok": true, "data": { "cancelledNotEnough": 1, "finished": 2, "rateLimitRowsCleaned": 120 } }
```

### GET /api/health

`{ "ok": true, "data": { "db": "up", "redis": "up|down|disabled" } }` (503 при недоступной БД).

## Коды ошибок

| Код                | HTTP | Смысл                                               |
| ------------------ | ---- | --------------------------------------------------- |
| BAD_REQUEST        | 400  | Невалидное тело/параметры (детали в `details`)      |
| FORM_REJECTED      | 400  | Time-trap: форма отправлена слишком быстро/устарела |
| CAPTCHA_FAILED     | 400  | Turnstile не пройден (если включён)                 |
| VALIDATION_FAILED  | 400  | Нарушение доменных инвариантов                      |
| FORBIDDEN          | 403  | Нет/неверный host-токен или cron-секрет             |
| GAME_NOT_FOUND     | 404  | Нет игры с таким кодом                              |
| NOT_PARTICIPANT    | 404  | Вы не записаны на игру                              |
| GAME_NOT_JOINABLE  | 409  | Запись закрыта (началась/отменена)                  |
| GAME_NOT_EDITABLE  | 409  | Игра в терминальном статусе                         |
| NICKNAME_TAKEN     | 409  | Никнейм занят в этой игре                           |
| ALREADY_JOINED     | 409  | Повторная запись тем же участником                  |
| DUPLICATE_GAME     | 409  | Игра рядом (≤150 м) ±60 мин уже существует          |
| NOT_ENOUGH_PLAYERS | 409  | Жеребьёвка: меньше 2 подтверждённых                 |
| HOST_GAME_LIMIT    | 429  | Лимит активных игр организатора                     |
| RATE_LIMITED       | 429  | Превышен rate limit (`Retry-After` в заголовке)     |
