import { z } from 'zod';

/**
 * Zod-схемы DTO. Файл без серверных импортов —
 * переиспользуется формами на клиенте и роутами на сервере.
 */

export const GAME_FORMATS = [
  // «Свободный» первым: это формат по умолчанию — играем как соберёмся
  'FREE',
  'FIVE_A_SIDE',
  'SIX_A_SIDE',
  'SEVEN_A_SIDE',
  'EIGHT_A_SIDE',
  'ELEVEN_A_SIDE',
] as const;

export const SKILL_LEVELS = ['ANY', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

export const POSITIONS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'ANY'] as const;

export const ATTENDANCE = ['CONFIRMED', 'MAYBE'] as const;

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
const CONTROL_CHARS_KEEP_NEWLINE = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F]', 'g');

/** Обрезка, схлопывание пробелов и удаление управляющих символов (анти-XSS гигиена). */
const singleLine = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min, `минимум ${min} симв.`).max(max, `максимум ${max} симв.`));

/** Как singleLine, но переводы строк сохраняются (описание игры). */
const multiLine = (max: number) =>
  z
    .string()
    .transform((s) =>
      s
        .replace(CONTROL_CHARS_KEEP_NEWLINE, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .pipe(z.string().max(max, `максимум ${max} симв.`));

const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('ru-RU', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'некорректная таймзона (ожидается IANA, например Europe/Moscow)' },
);

/** Time-trap токен, выданный сервером при рендере формы. */
export const formTokenSchema = z.object({
  ts: z.string().min(1),
  sig: z.string().min(1),
});

const antiAbuseFields = {
  /** Honeypot: настоящие пользователи это поле не видят и не заполняют. */
  website: z.string().optional(),
  formToken: formTokenSchema,
  turnstileToken: z.string().optional(),
};

export const createGameBodySchema = z.object({
  title: singleLine(3, 80),
  description: multiLine(2000).optional().default(''),
  format: z.enum(GAME_FORMATS),
  skillLevel: z.enum(SKILL_LEVELS),
  startsAt: z.coerce.date(),
  /** null — «как получится»: длительность заранее не фиксируется. */
  durationMinutes: z.coerce.number().int().min(30).max(480).nullable(),
  /** Сколько команд играет (лишние ждут очереди, как в быстрой игре). */
  teamCount: z.coerce.number().int().min(2).max(4).default(2),
  timezone: timezoneSchema,
  minPlayers: z.coerce.number().int().min(2).max(30),
  maxPlayers: z.coerce.number().int().min(4).max(30),
  /** В минимальных единицах валюты (копейки) — только целое. */
  pricePerPitch: z.coerce.number().int().min(0).max(100_000_000),
  currency: z.string().length(3).toUpperCase(),
  cancelDeadline: z.coerce.date(),
  venueName: singleLine(2, 80),
  address: singleLine(3, 160),
  city: singleLine(2, 60),
  ...antiAbuseFields,
});

export type CreateGameBody = z.infer<typeof createGameBodySchema>;

export const joinGameBodySchema = z.object({
  name: singleLine(2, 60),
  nickname: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(2, 'минимум 2 симв.')
        .max(24, 'максимум 24 симв.')
        .regex(/^[\p{L}\p{N} _.-]+$/u, 'только буквы, цифры, пробел и _ . -'),
    ),
  position: z.enum(POSITIONS),
  skillLevel: z.enum(SKILL_LEVELS).default('ANY'),
  attendance: z.enum(ATTENDANCE).default('CONFIRMED'),
  ...antiAbuseFields,
});

export type JoinGameBody = z.infer<typeof joinGameBodySchema>;

export const patchGameBodySchema = z
  .object({
    title: singleLine(3, 80),
    description: multiLine(2000),
    format: z.enum(GAME_FORMATS),
    skillLevel: z.enum(SKILL_LEVELS),
    startsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(30).max(480).nullable(),
    minPlayers: z.coerce.number().int().min(2).max(30),
    maxPlayers: z.coerce.number().int().min(4).max(30),
    pricePerPitch: z.coerce.number().int().min(0).max(100_000_000),
    cancelDeadline: z.coerce.date(),
    venueName: singleLine(2, 80),
    address: singleLine(3, 160),
    city: singleLine(2, 60),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'пустой PATCH — нечего менять',
  });

export type PatchGameBody = z.infer<typeof patchGameBodySchema>;

export const listGamesQuerySchema = z.object({
  city: z.string().trim().min(1).max(60).optional(),
  format: z.enum(GAME_FORMATS).optional(),
  skillLevel: z.enum(SKILL_LEVELS).optional(),
  hasFreeSlots: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(['soonest', 'few_slots']).default('soonest'),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;
