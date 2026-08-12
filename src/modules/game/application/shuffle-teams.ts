import { err, ok, type Result } from '@/shared/lib/result';
import { balanceTeams } from '../domain/team-balancer';
import type { TeamsSnapshot } from '../domain/types';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface ShuffleTeamsInput {
  gameCode: string;
  hostToken: string;
  /** Источник детерминизма; новый seed → новый расклад. */
  seed: number;
}

export interface ShuffleTeamsDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

export async function shuffleTeams(
  deps: ShuffleTeamsDeps,
  input: ShuffleTeamsInput,
): Promise<Result<{ teams: TeamsSnapshot }, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<{ teams: TeamsSnapshot }, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (!deps.tokens.verify(input.hostToken, tx.game.hostTokenHash)) {
        return err(domainError('FORBIDDEN', 'Неверный токен управления игрой'));
      }

      const players = (await tx.activeParticipants()).filter(
        (p) => p.role === 'MAIN' && p.attendance === 'CONFIRMED',
      );
      if (players.length < 2) {
        return err(
          domainError(
            'NOT_ENOUGH_PLAYERS',
            'Для жеребьёвки нужно минимум два подтверждённых игрока',
          ),
        );
      }

      const teams = balanceTeams(
        players.map((p) => ({
          participantId: p.id,
          nickname: p.nickname,
          position: p.position,
          skillLevel: p.skillLevel,
        })),
        input.seed,
        now,
      );

      await tx.updateGame({ teamsSnapshot: teams });
      await tx.audit('TEAMS_SHUFFLED', { seed: input.seed, players: players.length });
      return ok({ teams });
    },
  );

  if (result === null) {
    return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  }
  if (result.ok) {
    deps.events.publish(input.gameCode, { type: 'teams_shuffled', at: now.toISOString() });
  }
  return result;
}
