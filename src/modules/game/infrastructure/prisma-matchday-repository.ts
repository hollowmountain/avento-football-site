// Prisma нужен значением: Prisma.DbNull — единственный способ записать
// JSON-null в колонку rotation
import { Prisma } from '@/generated/prisma/client';
import type { PrismaClient } from '@/generated/prisma/client';
import type { RotationState } from '@/modules/quick/domain/rotation';
import type { QuickTeamColorId } from '@/modules/quick/domain/types';
import type { DayMatchTimer, MatchDayEntity } from '../domain/matchday';
import type {
  CreateMatchDayInput,
  MatchDayRepository,
  MatchDayTx,
  NewDayGoal,
} from '../application/matchday-ports';

type Tx = Prisma.TransactionClient;

const DAY_INCLUDE = {
  teams: { orderBy: { order: 'asc' } },
  members: true,
  matches: {
    orderBy: { order: 'asc' },
    include: { goals: { orderBy: { createdAt: 'asc' } } },
  },
} satisfies Prisma.MatchDayInclude;

const TEAM_COLORS: readonly QuickTeamColorId[] = [
  'amber',
  'green',
  'coral',
  'sky',
  'violet',
  'paper',
];

function toColorId(raw: string): QuickTeamColorId {
  return TEAM_COLORS.find((color) => color === raw) ?? 'paper';
}

/** Очередь команд лежит в Json — читаем её с проверкой формы. */
function toRotation(raw: Prisma.JsonValue | null): RotationState | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = raw as { playing?: unknown; waiting?: unknown };
  const playing = value.playing;
  const waiting = value.waiting;
  if (!Array.isArray(playing) || playing.length !== 2) return null;
  const [home, away] = playing;
  if (typeof home !== 'string' || typeof away !== 'string') return null;
  const queue = Array.isArray(waiting) ? waiting.filter((id) => typeof id === 'string') : [];
  return { playing: [home, away], waiting: queue };
}

async function loadDay(tx: Tx | PrismaClient, gameId: string): Promise<MatchDayEntity | null> {
  const row = await tx.matchDay.findUnique({ where: { gameId }, include: DAY_INCLUDE });
  if (row === null) return null;
  return {
    id: row.id,
    gameId: row.gameId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    rotation: toRotation(row.rotation),
    teams: row.teams.map((team) => ({
      id: team.id,
      name: team.name,
      colorId: toColorId(team.colorId),
      order: team.order,
    })),
    members: row.members.map((member) => ({
      participantId: member.participantId,
      teamId: member.teamId,
    })),
    matches: row.matches.map((match) => ({
      id: match.id,
      order: match.order,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      timer: {
        running: match.timerRunning,
        accumulatedMs: match.accumulatedMs,
        startedAt: match.timerStartedAt,
      },
      goals: match.goals.map((goal) => ({
        id: goal.id,
        teamId: goal.teamId,
        scorerParticipantId: goal.scorerParticipantId,
        assistParticipantId: goal.assistParticipantId,
      })),
    })),
  };
}

class PrismaMatchDayTx implements MatchDayTx {
  constructor(
    private readonly tx: Tx,
    public readonly day: MatchDayEntity,
  ) {}

  async renameTeam(teamId: string, name: string): Promise<void> {
    await this.tx.matchDayTeam.update({ where: { id: teamId }, data: { name } });
  }

  async assignMember(participantId: string, teamId: string | null): Promise<void> {
    // Опоздавший мог появиться в составе уже после старта дня — заводим строку
    await this.tx.matchDayMember.upsert({
      where: { participantId },
      create: { dayId: this.day.id, participantId, teamId },
      update: { teamId },
    });
  }

  async startMatch(input: {
    order: number;
    homeTeamId: string;
    awayTeamId: string;
    startedAt: Date;
  }): Promise<void> {
    await this.tx.dayMatch.create({
      data: {
        dayId: this.day.id,
        order: input.order,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        startedAt: input.startedAt,
        timerRunning: true,
        accumulatedMs: 0,
        timerStartedAt: input.startedAt,
      },
    });
  }

  async setTimer(matchId: string, timer: DayMatchTimer): Promise<void> {
    await this.tx.dayMatch.update({
      where: { id: matchId },
      data: {
        timerRunning: timer.running,
        accumulatedMs: timer.accumulatedMs,
        timerStartedAt: timer.startedAt,
      },
    });
  }

  async addGoal(matchId: string, goal: NewDayGoal): Promise<void> {
    await this.tx.dayGoal.create({ data: { matchId, ...goal } });
  }

  async removeGoal(goalId: string): Promise<void> {
    await this.tx.dayGoal.delete({ where: { id: goalId } });
  }

  async finishMatch(matchId: string, finishedAt: Date): Promise<void> {
    await this.tx.dayMatch.update({
      where: { id: matchId },
      data: { status: 'FINISHED', finishedAt, timerRunning: false },
    });
  }

  async setRotation(rotation: RotationState | null): Promise<void> {
    await this.tx.matchDay.update({
      where: { id: this.day.id },
      data: { rotation: rotation === null ? Prisma.DbNull : { ...rotation } },
    });
  }

  async finishDay(finishedAt: Date): Promise<void> {
    await this.tx.matchDay.update({
      where: { id: this.day.id },
      data: { status: 'FINISHED', finishedAt },
    });
  }

  async resumeDay(): Promise<void> {
    await this.tx.matchDay.update({
      where: { id: this.day.id },
      data: { status: 'LIVE', finishedAt: null },
    });
  }

  async markGameFinished(): Promise<void> {
    // Отменённую игру матч-день не воскрешает
    await this.tx.game.updateMany({
      where: { id: this.day.gameId, status: { in: ['OPEN', 'FULL'] } },
      data: { status: 'FINISHED' },
    });
  }
}

export class PrismaMatchDayRepository implements MatchDayRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGameId(gameId: string): Promise<MatchDayEntity | null> {
    return loadDay(this.prisma, gameId);
  }

  async create(input: CreateMatchDayInput): Promise<MatchDayEntity> {
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.matchDay.create({
        data: {
          gameId: input.gameId,
          startedAt: input.startedAt,
          teams: {
            create: input.teams.map((team, index) => ({
              name: team.name,
              colorId: team.colorId,
              order: index,
            })),
          },
        },
        include: { teams: { orderBy: { order: 'asc' } } },
      });
      await tx.matchDayMember.createMany({
        data: input.members.map((member) => ({
          dayId: created.id,
          participantId: member.participantId,
          teamId: created.teams[member.teamIndex]?.id ?? null,
        })),
      });
    });

    const day = await loadDay(this.prisma, input.gameId);
    if (day === null) throw new Error('матч-день создан, но не читается');
    return day;
  }

  async withDayLock<T>(gameId: string, fn: (tx: MatchDayTx) => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(
      async (tx) => {
        // Та же пессимистичная блокировка, что у состава игры: нажатия
        // создателя и менеджера не должны перемешиваться
        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "MatchDay" WHERE "gameId" = ${gameId} FOR UPDATE`;
        if (locked.length === 0) return null;

        const day = await loadDay(tx, gameId);
        if (day === null) return null;
        return fn(new PrismaMatchDayTx(tx, day));
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  }
}
