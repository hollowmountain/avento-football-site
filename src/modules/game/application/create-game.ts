import { err, ok, type Result } from '@/shared/lib/result';
import { validateGameDraft } from '../domain/game-rules';
import type { GameEntity, GameFormat, SkillLevel } from '../domain/types';
import { domainError, type DomainError } from './errors';
import {
  CodeCollisionError,
  type Clock,
  type GameCodeGenerator,
  type GameRepository,
  type TokenService,
} from './ports';

const CODE_ATTEMPTS = 5;

export interface CreateGameInput {
  title: string;
  description: string | null;
  format: GameFormat;
  skillLevel: SkillLevel;
  startsAt: Date;
  durationMinutes: number;
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
  /** Анонимный identity-токен создателя (cookie), plain. */
  creatorToken: string | null;
  createdIpHash: string;
}

export interface CreateGameOutput {
  game: GameEntity;
  /** Секретный токен управления — показывается один раз. */
  hostToken: string;
}

export interface CreateGameDeps {
  games: GameRepository;
  tokens: TokenService;
  codes: GameCodeGenerator;
  clock: Clock;
  config: {
    maxActiveGamesPerHost: number;
    dedupRadiusMeters: number;
    dedupWindowMinutes: number;
  };
}

export async function createGame(
  deps: CreateGameDeps,
  input: CreateGameInput,
): Promise<Result<CreateGameOutput, DomainError>> {
  const now = deps.clock.now();

  const validation = validateGameDraft(input, now);
  if (!validation.ok) {
    return err(
      domainError('VALIDATION_FAILED', 'Данные игры не прошли проверку', validation.error),
    );
  }

  const creatorTokenHash = input.creatorToken ? deps.tokens.hash(input.creatorToken) : null;

  if (creatorTokenHash) {
    const active = await deps.games.countActiveByCreator(creatorTokenHash, now);
    if (active >= deps.config.maxActiveGamesPerHost) {
      return err(
        domainError(
          'HOST_GAME_LIMIT',
          `У вас уже ${active} активных игр — сначала проведите или отмените их`,
        ),
      );
    }
  }

  const duplicate = await deps.games.findNearbyAt({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: deps.config.dedupRadiusMeters,
    startsAt: input.startsAt,
    windowMinutes: deps.config.dedupWindowMinutes,
  });
  if (duplicate) {
    return err(
      domainError(
        'DUPLICATE_GAME',
        `Рядом уже есть игра «${duplicate.title}» (${duplicate.code}) примерно на это время`,
        { code: duplicate.code },
      ),
    );
  }

  const hostToken = deps.tokens.generate();
  const hostTokenHash = deps.tokens.hash(hostToken);

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    try {
      const game = await deps.games.create({
        code: deps.codes.nextCode(),
        title: input.title,
        description: input.description,
        format: input.format,
        skillLevel: input.skillLevel,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        timezone: input.timezone,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        pricePerPitch: input.pricePerPitch,
        currency: input.currency,
        cancelDeadline: input.cancelDeadline,
        venueName: input.venueName,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        city: input.city,
        hostName: input.hostName,
        hostTokenHash,
        creatorTokenHash,
        createdIpHash: input.createdIpHash,
      });
      return ok({ game, hostToken });
    } catch (error) {
      if (error instanceof CodeCollisionError) continue;
      throw error;
    }
  }

  return err(domainError('CODE_GENERATION_FAILED', 'Не удалось сгенерировать код игры'));
}
