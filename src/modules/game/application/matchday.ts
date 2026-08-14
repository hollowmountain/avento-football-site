import { applyMatchResult, startRotation } from '@/modules/quick/domain/rotation';
import { err, ok, type Result } from '@/shared/lib/result';
import {
  canStartMatchDay,
  distributeMembers,
  liveMatch,
  matchResult,
  matchScore,
  type MatchDayEntity,
} from '../domain/matchday';
import { domainError, type DomainError } from './errors';
import type { MatchDayRepository, MatchDayTx, NewMatchDayTeam } from './matchday-ports';
import type { Clock, EventBus, GameRepository } from './ports';

/**
 * Матч-день обычной игры. Правила — те же, что в «Быстрой игре»
 * (победитель остаётся, ничья решается суефа), но протокол ведёт
 * менеджер на сервере, и каждый гол записан на конкретного участника.
 */
export type MatchDayCommand =
  | { kind: 'renameTeam'; teamId: string; name: string }
  | { kind: 'assign'; participantId: string; teamId: string | null }
  | { kind: 'startMatch'; homeTeamId: string; awayTeamId: string }
  | { kind: 'timer'; running: boolean }
  | {
      kind: 'goal';
      teamId: string;
      scorerParticipantId: string | null;
      assistParticipantId: string | null;
    }
  | { kind: 'undoGoal' }
  | { kind: 'finishMatch'; drawLoserTeamId: string | null }
  | { kind: 'finishDay' }
  | { kind: 'resumeDay' };

export interface MatchDayDeps {
  days: MatchDayRepository;
  games: GameRepository;
  clock: Clock;
  events: EventBus;
}

/** Запуск протокола: команды дня и стартовое распределение состава. */
export async function startMatchDay(
  deps: MatchDayDeps,
  input: { gameCode: string; teams: NewMatchDayTeam[] },
): Promise<Result<MatchDayEntity, DomainError>> {
  const game = await deps.games.findByCode(input.gameCode);
  if (game === null) return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));

  const now = deps.clock.now();
  if (!canStartMatchDay(game, now)) {
    return err(domainError('MATCHDAY_NOT_YET', 'Матч-день открывается за два часа до начала игры'));
  }

  // Повторное нажатие «начать» не создаёт второй день
  const existing = await deps.days.findByGameId(game.id);
  if (existing !== null) return ok(existing);

  const main = (await deps.games.activeParticipants(game.id)).filter((p) => p.role === 'MAIN');
  if (main.length < 2) {
    return err(domainError('MATCHDAY_NOT_ENOUGH', 'Для матч-дня нужно хотя бы двое записавшихся'));
  }

  const teams = input.teams.slice(0, Math.max(2, Math.min(4, game.teamCount)));
  if (teams.length < 2) {
    return err(domainError('VALIDATION_FAILED', 'Нужно как минимум две команды'));
  }

  const day = await deps.days.create({
    gameId: game.id,
    teams,
    members: distributeMembers(
      main.map((p) => p.id),
      teams.length,
      game.teamsSnapshot,
    ),
    startedAt: now,
  });

  deps.events.publish(game.code, { type: 'matchday_changed', at: now.toISOString() });
  return ok(day);
}

/** Любое действие менеджера в протоколе. Возвращает день целиком. */
export async function runMatchDayCommand(
  deps: MatchDayDeps,
  input: { gameCode: string; command: MatchDayCommand },
): Promise<Result<MatchDayEntity, DomainError>> {
  const game = await deps.games.findByCode(input.gameCode);
  if (game === null) return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));

  const roster = new Set(
    (await deps.games.activeParticipants(game.id))
      .filter((p) => p.role === 'MAIN')
      .map((p) => p.id),
  );
  const now = deps.clock.now();

  const outcome = await deps.days.withDayLock(game.id, (tx) =>
    applyCommand(tx, input.command, roster, now),
  );
  if (outcome === null) return err(domainError('MATCHDAY_NOT_STARTED', 'Матч-день ещё не начат'));
  if (!outcome.ok) return outcome;

  const day = await deps.days.findByGameId(game.id);
  if (day === null) return err(domainError('MATCHDAY_NOT_STARTED', 'Матч-день ещё не начат'));

  deps.events.publish(game.code, { type: 'matchday_changed', at: now.toISOString() });
  return ok(day);
}

async function applyCommand(
  tx: MatchDayTx,
  command: MatchDayCommand,
  roster: ReadonlySet<string>,
  now: Date,
): Promise<Result<null, DomainError>> {
  const { day } = tx;
  const live = liveMatch(day);
  const teamIds = new Set(day.teams.map((team) => team.id));

  switch (command.kind) {
    case 'renameTeam': {
      if (!teamIds.has(command.teamId)) return err(notFound('Команда не найдена'));
      await tx.renameTeam(command.teamId, command.name);
      return ok(null);
    }

    case 'assign': {
      if (!roster.has(command.participantId)) {
        return err(domainError('VALIDATION_FAILED', 'Этого игрока нет в основном составе'));
      }
      if (command.teamId !== null && !teamIds.has(command.teamId)) {
        return err(notFound('Команда не найдена'));
      }
      // Пока идёт матч, перекидывать игроков нельзя: голы уже записаны
      // на команды, и таблица дня разъедется с тем, что было на поле
      if (live !== null) {
        return err(domainError('MATCH_IN_PROGRESS', 'Сначала завершите текущий матч'));
      }
      await tx.assignMember(command.participantId, command.teamId);
      return ok(null);
    }

    case 'startMatch': {
      if (live !== null) return err(domainError('MATCH_IN_PROGRESS', 'Матч уже идёт'));
      if (day.status === 'FINISHED') return err(dayFinished());
      if (command.homeTeamId === command.awayTeamId) {
        return err(domainError('VALIDATION_FAILED', 'Команда не может играть сама с собой'));
      }
      if (!teamIds.has(command.homeTeamId) || !teamIds.has(command.awayTeamId)) {
        return err(notFound('Команда не найдена'));
      }

      // Очередь заводится при первом матче: остальные команды ждут
      if (day.rotation === null) {
        await tx.setRotation(
          startRotation(
            [command.homeTeamId, command.awayTeamId],
            day.teams
              .map((team) => team.id)
              .filter((id) => id !== command.homeTeamId && id !== command.awayTeamId),
          ),
        );
      }
      await tx.startMatch({
        order: day.matches.length + 1,
        homeTeamId: command.homeTeamId,
        awayTeamId: command.awayTeamId,
        startedAt: now,
      });
      return ok(null);
    }

    case 'timer': {
      if (live === null) return err(noLiveMatch());
      if (command.running === live.timer.running) return ok(null);
      await tx.setTimer(
        live.id,
        command.running
          ? { running: true, accumulatedMs: live.timer.accumulatedMs, startedAt: now }
          : {
              running: false,
              // Пауза фиксирует всё, что натикало с последнего запуска
              accumulatedMs:
                live.timer.accumulatedMs +
                Math.max(0, now.getTime() - (live.timer.startedAt ?? now).getTime()),
              startedAt: null,
            },
      );
      return ok(null);
    }

    case 'goal': {
      if (live === null) return err(noLiveMatch());
      if (command.teamId !== live.homeTeamId && command.teamId !== live.awayTeamId) {
        return err(domainError('VALIDATION_FAILED', 'Эта команда сейчас не на поле'));
      }
      const squad = new Set(
        day.members.filter((m) => m.teamId === command.teamId).map((m) => m.participantId),
      );
      for (const id of [command.scorerParticipantId, command.assistParticipantId]) {
        if (id !== null && !squad.has(id)) {
          return err(domainError('VALIDATION_FAILED', 'Этот игрок не в составе забившей команды'));
        }
      }
      if (
        command.scorerParticipantId !== null &&
        command.scorerParticipantId === command.assistParticipantId
      ) {
        return err(domainError('VALIDATION_FAILED', 'Ассистент не может быть автором гола'));
      }
      await tx.addGoal(live.id, {
        teamId: command.teamId,
        scorerParticipantId: command.scorerParticipantId,
        // Пас без автора гола не имеет смысла
        assistParticipantId:
          command.scorerParticipantId === null ? null : command.assistParticipantId,
      });
      return ok(null);
    }

    case 'undoGoal': {
      if (live === null) return err(noLiveMatch());
      const last = live.goals.at(-1);
      if (last === undefined) return err(domainError('VALIDATION_FAILED', 'Голов пока нет'));
      await tx.removeGoal(last.id);
      return ok(null);
    }

    case 'finishMatch': {
      if (live === null) return err(noLiveMatch());
      const score = matchScore(live);
      const rotation = day.rotation ?? startRotation([live.homeTeamId, live.awayTeamId], []);
      const hasQueue = rotation.waiting.length > 0;
      // Ничью счёт не решает: команды играют суефа, проигравшего
      // менеджер отмечает в диалоге завершения
      if (hasQueue && score.home === score.away) {
        if (
          command.drawLoserTeamId !== live.homeTeamId &&
          command.drawLoserTeamId !== live.awayTeamId
        ) {
          return err(domainError('DRAW_LOSER_REQUIRED', 'Отметьте, кто проиграл суефа'));
        }
      }

      await tx.finishMatch(live.id, now);
      await tx.setRotation(
        applyMatchResult(rotation, matchResult(live), command.drawLoserTeamId ?? undefined).state,
      );
      return ok(null);
    }

    case 'finishDay': {
      if (live !== null) return err(domainError('MATCH_IN_PROGRESS', 'Сначала завершите матч'));
      if (day.status === 'FINISHED') return ok(null);
      await tx.finishDay(now);
      await tx.markGameFinished();
      return ok(null);
    }

    case 'resumeDay': {
      if (day.status === 'LIVE') return ok(null);
      await tx.resumeDay();
      return ok(null);
    }
  }
}

const notFound = (message: string): DomainError => domainError('VALIDATION_FAILED', message);
const noLiveMatch = (): DomainError => domainError('NO_LIVE_MATCH', 'Сейчас нет идущего матча');
const dayFinished = (): DomainError =>
  domainError('MATCHDAY_FINISHED', 'Матч-день уже завершён — верните его в игру');
