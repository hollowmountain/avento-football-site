import { err, ok, type Result } from '@/shared/lib/result';
import type { TeamsSnapshot } from '../domain/types';
import { domainError, type DomainError } from './errors';
import { isHostAuthorized, type HostAuth } from './host-auth';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface SetTeamsInput extends HostAuth {
  gameCode: string;
  teamA: string[]; // participant ids
  teamB: string[];
}

export interface SetTeamsDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

/**
 * Ручная правка составов после жеребьёвки (drag-and-drop организатора).
 * Проверяем, что каждый id — активный основной участник и никто не задвоен.
 */
export async function setTeams(
  deps: SetTeamsDeps,
  input: SetTeamsInput,
): Promise<Result<{ teams: TeamsSnapshot }, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<{ teams: TeamsSnapshot }, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (!isHostAuthorized(deps.tokens, tx.game, input)) {
        return err(domainError('FORBIDDEN', 'Управлять игрой может только организатор'));
      }

      const ids = [...input.teamA, ...input.teamB];
      if (new Set(ids).size !== ids.length) {
        return err(domainError('VALIDATION_FAILED', 'Игрок не может быть в двух командах'));
      }

      const eligible = new Map(
        (await tx.activeParticipants()).filter((p) => p.role === 'MAIN').map((p) => [p.id, p]),
      );
      const unknown = ids.filter((id) => !eligible.has(id));
      if (unknown.length > 0) {
        return err(
          domainError('VALIDATION_FAILED', 'В составах есть игроки не из основного состава', {
            unknown,
          }),
        );
      }

      const toMember = (id: string) => {
        const p = eligible.get(id)!;
        return {
          participantId: p.id,
          nickname: p.nickname,
          position: p.position,
          skillLevel: p.skillLevel,
        };
      };

      const teams: TeamsSnapshot = {
        seed: tx.game.teamsSnapshot?.seed ?? 0,
        generatedAt: now.toISOString(),
        teamA: input.teamA.map(toMember),
        teamB: input.teamB.map(toMember),
      };

      await tx.updateGame({ teamsSnapshot: teams });
      await tx.audit('TEAMS_EDITED', { teamA: input.teamA, teamB: input.teamB });
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
