import { z } from 'zod';

/**
 * Валидация переменных окружения на старте (fail-fast).
 * Модуль импортируется только на сервере.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // PostgreSQL. Пример: postgresql://user:pass@host:5432/db?sslmode=require
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, 'ожидается postgres:// URL'),

  // Redis опционален: без него rate limit и кэш работают через PostgreSQL.
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\/.+/, 'ожидается redis:// URL')
    .optional(),

  // Серверные секреты
  TOKEN_PEPPER: z.string().min(16, 'минимум 16 символов'),
  IP_HASH_SALT: z.string().min(16, 'минимум 16 символов'),
  CRON_SECRET: z.string().min(16, 'минимум 16 символов'),

  // Публичный адрес приложения (для ссылок-приглашений, ICS, OG)
  APP_URL: z.url().default('http://localhost:3000'),

  // Дефолты продукта
  DEFAULT_CITY: z.string().min(1).default('Москва'),
  DEFAULT_CURRENCY: z.string().length(3).default('RUB'),
  DEFAULT_TIMEZONE: z.string().min(1).default('Europe/Moscow'),

  // Теги-администраторы: создают игры без лимитов количества и дедупа
  ADMIN_TAGS: z
    .string()
    .default('ice')
    .transform((raw) =>
      raw
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ''),
    ),

  // Anti-abuse (значения лимитов — только через ENV, не в коде)
  RATE_CREATE_GAME_PER_DAY: z.coerce.number().int().positive().default(3),
  RATE_CREATE_GAME_PER_10MIN: z.coerce.number().int().positive().default(1),
  RATE_MAX_ACTIVE_GAMES_PER_HOST: z.coerce.number().int().positive().default(2),
  RATE_GLOBAL_WRITES_PER_MIN: z.coerce.number().int().positive().default(30),
  DEDUP_RADIUS_METERS: z.coerce.number().positive().default(150),
  DEDUP_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  FORM_MIN_SUBMIT_SECONDS: z.coerce.number().positive().default(2),

  TURNSTILE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

  // Геокодер адресов: nominatim (по умолчанию) или stub без сети — для тестов
  GEOCODER: z.enum(['nominatim', 'stub']).default('nominatim'),

  WEATHER_CACHE_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некорректная конфигурация окружения:\n${details}`);
  }
  if (parsed.data.TURNSTILE_ENABLED && !parsed.data.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_ENABLED=true требует TURNSTILE_SECRET_KEY');
  }
  return parsed.data;
}

export const env = loadEnv();
