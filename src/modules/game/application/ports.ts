import type {
  Attendance,
  GameEntity,
  GameFormat,
  GameStatus,
  ParticipantEntity,
  Position,
  SkillLevel,
  TeamsSnapshot,
} from '../domain/types';

// ---------- Инфраструктурные порты (реализации — в infrastructure) ----------

export interface Clock {
  now(): Date;
}

/** Генерация и хеширование анонимных токенов (host/participant). */
export interface TokenService {
  generate(): string;
  hash(token: string): string;
  /** Сравнение за константное время. */
  verify(token: string, storedHash: string): boolean;
}

export interface GameCodeGenerator {
  nextCode(): string;
}

export type GameEventType =
  'participants_changed' | 'game_updated' | 'teams_shuffled' | 'game_cancelled';

export interface GameEvent {
  type: GameEventType;
  at: string; // ISO
}

/** Шина live-событий страницы игры (SSE). Публикация — после коммита транзакции. */
export interface EventBus {
  publish(gameCode: string, event: GameEvent): void;
  subscribe(gameCode: string, listener: (event: GameEvent) => void): () => void;
}

// ---------- Репозитории ----------

export interface NewGameRecord {
  code: string;
  title: string;
  description: string | null;
  format: GameFormat;
  skillLevel: SkillLevel;
  startsAt: Date;
  durationMinutes: number | null;
  teamCount: number;
  timezone: string;
  minPlayers: number;
  maxPlayers: number;
  pricePerPitch: number;
  currency: string;
  cancelDeadline: Date;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  hostName: string;
  hostTokenHash: string;
  creatorTokenHash: string | null;
  creatorProfileId: string | null;
  createdIpHash: string;
}

export interface GamePatch {
  title?: string;
  description?: string | null;
  format?: GameFormat;
  skillLevel?: SkillLevel;
  startsAt?: Date;
  durationMinutes?: number | null;
  minPlayers?: number;
  maxPlayers?: number;
  pricePerPitch?: number;
  cancelDeadline?: Date;
  venueName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  status?: GameStatus;
  teamsSnapshot?: TeamsSnapshot;
}

export interface GameListFilters {
  city?: string;
  dateFrom?: Date;
  dateTo?: Date;
  format?: GameFormat;
  skillLevel?: SkillLevel;
  hasFreeSlots?: boolean;
}

export type GameListSort = 'soonest' | 'few_slots';

export interface GameListItem {
  game: GameEntity;
  activeMainCount: number;
}

export interface GameListPage {
  items: GameListItem[];
  nextCursor: string | null;
}

/** Данные reliability-профиля (живут дольше одной игры). */
export interface ParticipantReliability {
  gamesJoined: number;
  gamesAttended: number;
  lateCancels: number;
}

/** Игра в списке кабинета: роль зрителя и заполненность состава. */
export interface ProfileGameItem {
  game: GameEntity;
  activeMainCount: number;
  roles: ('HOST' | 'PLAYER')[];
}

export interface GameRepository {
  findByCode(code: string): Promise<GameEntity | null>;
  /** Игры кабинета: созданные и с активной записью, свежие сверху. */
  listByProfile(profileId: string, limit: number): Promise<ProfileGameItem[]>;
  /** Активные участники (leftAt IS NULL), MAIN — по порядку вступления, затем waitlist. */
  activeParticipants(gameId: string): Promise<ParticipantEntity[]>;
  activeMainCount(gameId: string): Promise<number>;
  /** Reliability-профили по хешам токенов (для бейджей). */
  profilesFor(tokenHashes: string[]): Promise<Map<string, ParticipantReliability>>;
  /**
   * Создание игры. Бросает CodeCollisionError при гонке на unique(code) —
   * вызывающий код генерирует новый код и повторяет.
   */
  create(record: NewGameRecord): Promise<GameEntity>;
  countActiveByCreator(creatorTokenHash: string, now: Date): Promise<number>;
  /** Дубликат: та же точка (радиус в метрах) ± окно в минутах от startsAt. */
  findNearbyAt(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startsAt: Date;
    windowMinutes: number;
  }): Promise<GameEntity | null>;
  list(
    filters: GameListFilters,
    sort: GameListSort,
    cursor: string | null,
    limit: number,
  ): Promise<GameListPage>;
  /** Кандидаты на отмену: OPEN, дедлайн прошёл. Число основных игроков проверяется под локом. */
  findCodesToCancel(now: Date, limit: number): Promise<string[]>;
  /** Кандидаты на завершение: OPEN/FULL, игра уже закончилась по времени. */
  findCodesToFinish(now: Date, limit: number): Promise<string[]>;
}

export class CodeCollisionError extends Error {
  constructor() {
    super('game code collision');
    this.name = 'CodeCollisionError';
  }
}

// ---------- Транзакционная единица работы ----------

export interface NewParticipantRecord {
  name: string;
  nickname: string;
  position: Position;
  skillLevel: SkillLevel;
  attendance: Attendance;
  role: 'MAIN' | 'WAITLIST';
  waitlistOrder: number | null;
  tokenHash: string;
  /** Кабинет участника (null — гость). */
  profileId: string | null;
}

export interface ParticipantPatch {
  name?: string;
  nickname?: string;
  position?: Position;
  skillLevel?: SkillLevel;
  attendance?: Attendance;
  role?: 'MAIN' | 'WAITLIST';
  waitlistOrder?: number | null;
  leftAt?: Date | null;
  wasLateCancel?: boolean;
  profileId?: string | null;
}

export interface ProfileDelta {
  joined?: number;
  attended?: number;
  lateCancels?: number;
}

/** Операции внутри транзакции с залоченной строкой игры. */
export interface GameTx {
  /** Игра, перечитанная после захвата лока. */
  readonly game: GameEntity;
  activeMainCount(): Promise<number>;
  maxWaitlistOrder(): Promise<number | null>;
  activeParticipants(): Promise<ParticipantEntity[]>;
  findParticipantByToken(tokenHash: string): Promise<ParticipantEntity | null>;
  findParticipantByNickname(nickname: string): Promise<ParticipantEntity | null>;
  insertParticipant(record: NewParticipantRecord): Promise<ParticipantEntity>;
  updateParticipant(id: string, patch: ParticipantPatch): Promise<ParticipantEntity>;
  /** Первый в очереди ожидания (leftAt IS NULL, role WAITLIST, min waitlistOrder). */
  firstWaitlisted(): Promise<ParticipantEntity | null>;
  updateGame(patch: GamePatch): Promise<GameEntity>;
  bumpProfile(tokenHash: string, delta: ProfileDelta): Promise<void>;
  audit(action: string, payload: Record<string, unknown>): Promise<void>;
}

export interface UnitOfWork {
  /**
   * Выполняет fn в транзакции, захватив SELECT ... FOR UPDATE на строке игры.
   * Возвращает null, если игры с таким кодом нет.
   */
  withGameLock<T>(gameCode: string, fn: (tx: GameTx) => Promise<T>): Promise<T | null>;
}
