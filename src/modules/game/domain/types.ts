/**
 * Доменные типы. Слой domain ни от чего не зависит:
 * значения совпадают с enum'ами Prisma по именам, маппинг — забота infrastructure.
 */
export type GameStatus =
  | 'OPEN'
  | 'FULL'
  | 'CANCELLED_BY_HOST'
  | 'CANCELLED_NOT_ENOUGH'
  | 'FINISHED'
  /** Снята владельцем сайта: в ленте нет, в кабинетах видна с причиной. */
  | 'REMOVED_BY_ADMIN';

/** Причины снятия игры модерацией — код, текст берётся из переводов. */
export type RemovalReason = 'WRONG_TITLE' | 'MISTAKE' | 'DUPLICATE' | 'RULES' | 'OTHER';

export type GameFormat =
  'FREE' | 'FIVE_A_SIDE' | 'SIX_A_SIDE' | 'SEVEN_A_SIDE' | 'EIGHT_A_SIDE' | 'ELEVEN_A_SIDE';

export type SkillLevel =
  | 'ANY'
  | 'BEGINNER'
  | 'AMATEUR'
  | 'INTERMEDIATE'
  | 'ADVANCED' // легаси: показывается как «Полупрофи»
  | 'SEMI_PRO'
  | 'PRO';

export type Position = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD' | 'ANY';

export type Attendance = 'CONFIRMED' | 'MAYBE';

export type ParticipantRole = 'MAIN' | 'WAITLIST';

/** Публичная игра или приватная — по ссылке с ключом либо по паролю. */
export type GameVisibility = 'PUBLIC' | 'PRIVATE_LINK' | 'PRIVATE_PASSWORD';

export interface TeamMember {
  participantId: string;
  nickname: string;
  position: Position;
  skillLevel: SkillLevel;
}

export interface TeamsSnapshot {
  seed: number;
  generatedAt: string; // ISO
  teamA: TeamMember[];
  teamB: TeamMember[];
}

export interface GameEntity {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: GameStatus;
  format: GameFormat;
  skillLevel: SkillLevel;
  startsAt: Date;
  /** null — «как получится»: длительность заранее не фиксирована. */
  durationMinutes: number | null;
  /** Сколько команд играет (2–4, лишние ждут очереди). */
  teamCount: number;
  timezone: string;
  minPlayers: number;
  maxPlayers: number;
  pricePerPitch: number; // минимальные единицы валюты
  currency: string;
  cancelDeadline: Date;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  visibility: GameVisibility;
  /** Хеш ключа записи (ссылка или пароль); null — игра публичная. */
  joinKeyHash: string | null;
  /** Ключ-приглашение (только PRIVATE_LINK) — наружу отдаётся лишь организатору. */
  inviteKey: string | null;
  hostName: string;
  hostTokenHash: string;
  /** Кабинет создателя (null — старые игры до кабинетов). */
  creatorProfileId: string | null;
  /** Менеджер матч-дня из записавшихся (null — протокол ведёт создатель). */
  managerProfileId: string | null;
  teamsSnapshot: TeamsSnapshot | null;
  /** Код причины снятия модерацией (null — игру не снимали). */
  removalReason: string | null;
  /** Пояснение владельца к снятию, если он его оставил. */
  removalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantEntity {
  id: string;
  gameId: string;
  name: string;
  nickname: string;
  position: Position;
  skillLevel: SkillLevel;
  attendance: Attendance;
  role: ParticipantRole;
  waitlistOrder: number | null;
  /** Хеш анонимного токена участника. Наружу (в DTO) не отдаётся. */
  tokenHash: string;
  joinedAt: Date;
  leftAt: Date | null;
  wasLateCancel: boolean;
  /** Кабинет участника (null — гость без профиля). */
  profileId: string | null;
  /** Тег профиля для отображения (@tag); заполняется выборкой с include. */
  profileTag: string | null;
  /** Код страны из профиля — флаг рядом с ником. */
  profileCountry: string | null;
  /** Любимый клуб из профиля — значок рядом с ником. */
  profileClub: string | null;
}
