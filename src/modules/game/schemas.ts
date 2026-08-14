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

// ADVANCED — легаси-значение старых записей, в выбор не попадает
export const SKILL_LEVELS = [
  'ANY',
  'BEGINNER',
  'AMATEUR',
  'INTERMEDIATE',
  'ADVANCED',
  'SEMI_PRO',
  'PRO',
] as const;

/** Пять уровней для выбора игроком в кабинете (без ANY и легаси). */
export const PICKABLE_SKILL_LEVELS = [
  'BEGINNER',
  'AMATEUR',
  'INTERMEDIATE',
  'SEMI_PRO',
  'PRO',
] as const;

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
  /** Организатор играет сам: по умолчанию да — иначе состав остаётся пустым. */
  joinAsPlayer: z.boolean().default(true),
  ...antiAbuseFields,
});

export type CreateGameBody = z.infer<typeof createGameBodySchema>;

export const joinGameBodySchema = z.object({
  // У владельца кабинета имя и ник берутся из профиля — клиент их не шлёт;
  // гость обязан прислать оба, это проверяет роут
  name: singleLine(2, 60).optional(),
  nickname: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(2, 'минимум 2 симв.')
        .max(24, 'максимум 24 симв.')
        .regex(/^[\p{L}\p{N} _.-]+$/u, 'только буквы, цифры, пробел и _ . -'),
    )
    .optional(),
  // Позицию и уровень при записи не спрашиваем: уровень берётся из
  // кабинета участника (у гостей — «не указан»)
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

// ─── Матч-день ─────────────────────────────────────────────────────────────

/** Палитра команд — та же, что в «Быстрой игре» (QuickTeamColorId). */
export const TEAM_COLOR_IDS = ['amber', 'green', 'coral', 'sky', 'violet', 'paper'] as const;

const teamNameSchema = singleLine(1, 24);
const idSchema = z.string().min(1).max(40);

export const startMatchDayBodySchema = z.object({
  // Названия команд приходят с клиента: там живут переводы next-intl
  teams: z
    .array(z.object({ name: teamNameSchema, colorId: z.enum(TEAM_COLOR_IDS) }))
    .min(2)
    .max(4),
});

/** Одна ручка на все действия протокола: разбор — по полю kind. */
export const matchDayCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('renameTeam'), teamId: idSchema, name: teamNameSchema }),
  z.object({ kind: z.literal('assign'), participantId: idSchema, teamId: idSchema.nullable() }),
  z.object({ kind: z.literal('startMatch'), homeTeamId: idSchema, awayTeamId: idSchema }),
  z.object({ kind: z.literal('timer'), running: z.boolean() }),
  z.object({
    kind: z.literal('goal'),
    teamId: idSchema,
    scorerParticipantId: idSchema.nullable(),
    assistParticipantId: idSchema.nullable(),
  }),
  z.object({ kind: z.literal('undoGoal') }),
  z.object({ kind: z.literal('finishMatch'), drawLoserTeamId: idSchema.nullable().default(null) }),
  z.object({ kind: z.literal('finishDay') }),
  z.object({ kind: z.literal('resumeDay') }),
]);

export type MatchDayCommandBody = z.infer<typeof matchDayCommandSchema>;

/** Кому вести протокол: участник основного состава или null — снова создателю. */
export const setManagerBodySchema = z.object({ participantId: idSchema.nullable() });

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
