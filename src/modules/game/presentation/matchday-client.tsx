'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, Play, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { computeStandings } from '@/modules/quick/domain/standings';
import { DEFAULT_TEAM_COLORS } from '@/modules/quick/presentation/default-teams';
import { teamColorVar } from '@/modules/quick/presentation/team-colors';
import { useGameEvents } from '@/shared/hooks/use-game-events';
import { useHostToken } from '@/shared/hooks/use-host-token';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Pill } from '@/shared/ui/pill';
import type { MatchDayCommand } from '../application/matchday';
import { liveMatch, matchScore, nextPair, playedResults } from '../domain/matchday';
import type { ParticipantDto } from './dto';
import type { DayTeamDto, MatchDayDto, MatchDayViewData } from './matchday-dto';
import { MatchDayMatch, playerName } from './matchday-match';

/**
 * Матч-день обычной игры: протокол в формате «Быстрой игры», но на
 * сервере. Ведёт менеджер (создатель или назначенный им игрок),
 * остальные видят то же самое и обновляются по SSE.
 */
export function MatchDayClient({
  code,
  initialData,
}: {
  code: string;
  initialData: MatchDayViewData;
}) {
  const t = useTranslations('matchday');
  const tCommon = useTranslations('common');
  const tDefaults = useTranslations('quick.teamDefaults');

  const queryClient = useQueryClient();
  const hostToken = useHostToken(code);
  const [managerOpen, setManagerOpen] = useState(false);

  const headers = (): Record<string, string> => (hostToken ? { 'x-host-token': hostToken } : {});

  const query = useQuery({
    queryKey: ['matchday', code],
    queryFn: () =>
      apiFetch<MatchDayViewData>(`/api/games/${code}/matchday`, { headers: headers() }),
    initialData,
    initialDataUpdatedAt: 0,
    refetchOnWindowFocus: true,
  });
  const data = query.data;

  useGameEvents(code, () => {
    void queryClient.invalidateQueries({ queryKey: ['matchday', code] });
  });

  const onError = (error: unknown) => {
    toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    void queryClient.invalidateQueries({ queryKey: ['matchday', code] });
  };

  // Каждое действие возвращает состояние целиком — кладём его в кэш как есть
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<MatchDayViewData>(`/api/games/${code}/matchday`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      }),
    onSuccess: (fresh) => queryClient.setQueryData(['matchday', code], fresh),
    onError,
  });

  const managerMutation = useMutation({
    mutationFn: (participantId: string | null) =>
      apiFetch(`/api/games/${code}/manager`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ participantId }),
      }),
    onSuccess: () => {
      setManagerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['matchday', code] });
    },
    onError,
  });

  const run = (command: MatchDayCommand) => mutation.mutate(command);

  const startDay = () => {
    const count = Math.max(2, Math.min(4, data.game.teamCount));
    mutation.mutate({
      teams: DEFAULT_TEAM_COLORS.slice(0, count).map((colorId) => ({
        name: tDefaults(colorId),
        colorId,
      })),
    });
  };

  const day = data.day;
  const live = day === null ? null : liveMatch(day);
  const teams = new Map((day?.teams ?? []).map((team) => [team.id, team]));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="display text-3xl leading-none">{t('title')}</h1>
        {live !== null ? (
          <Pill tone="accent">{t('matchNumber', { number: live.order })}</Pill>
        ) : null}
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground ml-auto">
          <Link href={`/games/${code}`}>
            <ArrowLeft className="size-4" aria-hidden /> {t('backToGame')}
          </Link>
        </Button>
      </header>

      <p className="text-muted-foreground -mt-3 text-sm">{data.game.title}</p>

      {day === null ? (
        <StartScreen data={data} pending={mutation.isPending} onStart={startDay} />
      ) : live !== null ? (
        <MatchDayMatch
          day={day}
          match={live}
          teams={teams}
          participants={data.participants}
          isManager={data.viewer.isManager}
          pending={mutation.isPending}
          run={run}
        />
      ) : (
        <DayScreen
          data={data}
          day={day}
          teams={teams}
          pending={mutation.isPending}
          run={run}
          onAssignManager={() => setManagerOpen(true)}
        />
      )}

      {managerOpen ? (
        <ManagerDialog
          data={data}
          pending={managerMutation.isPending}
          onClose={() => setManagerOpen(false)}
          onPick={(participantId) => managerMutation.mutate(participantId)}
        />
      ) : null}
    </div>
  );
}

/** День ещё не начат: ждём времени или запускаем протокол. */
function StartScreen({
  data,
  pending,
  onStart,
}: {
  data: MatchDayViewData;
  pending: boolean;
  onStart: () => void;
}) {
  const t = useTranslations('matchday');

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          {!data.canStart ? t('notYet') : data.viewer.isManager ? t('startLead') : t('notStarted')}
        </p>
        {data.canStart && data.viewer.isManager ? (
          <Button
            type="button"
            size="lg"
            className="display text-base tracking-wide"
            disabled={pending}
            onClick={onStart}
          >
            <Play data-icon="inline-start" aria-hidden />
            {t('start')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Между матчами: составы, следующая пара, таблица и журнал. */
function DayScreen({
  data,
  day,
  teams,
  pending,
  run,
  onAssignManager,
}: {
  data: MatchDayViewData;
  day: MatchDayDto;
  teams: Map<string, DayTeamDto>;
  pending: boolean;
  run: (command: MatchDayCommand) => void;
  onAssignManager: () => void;
}) {
  const t = useTranslations('matchday');
  const isManager = data.viewer.isManager;
  const finished = day.status === 'FINISHED';
  const pair = nextPair(day);
  const played = day.matches.filter((match) => match.status === 'FINISHED');

  return (
    <>
      {!finished ? (
        <RosterSection
          data={data}
          day={day}
          teams={teams}
          pending={pending}
          isManager={isManager}
          run={run}
        />
      ) : null}

      {!finished && pair !== null ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <span className="eyebrow text-muted-foreground">{t('kickoff')}</span>
            <p className="display text-2xl leading-none">
              <span style={{ color: teamColorVar(teams.get(pair[0])?.colorId ?? 'paper') }}>
                {teams.get(pair[0])?.name}
              </span>
              <span className="text-muted-foreground"> — </span>
              <span style={{ color: teamColorVar(teams.get(pair[1])?.colorId ?? 'paper') }}>
                {teams.get(pair[1])?.name}
              </span>
            </p>
            {day.rotation !== null && day.rotation.waiting.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {t('queue', {
                  teams: day.rotation.waiting
                    .map((id) => teams.get(id)?.name ?? '')
                    .filter((name) => name !== '')
                    .join(' · '),
                })}
              </p>
            ) : null}
            {isManager ? (
              <Button
                type="button"
                size="lg"
                className="display self-start text-base tracking-wide"
                disabled={pending}
                onClick={() =>
                  run({ kind: 'startMatch', homeTeamId: pair[0], awayTeamId: pair[1] })
                }
              >
                <Play data-icon="inline-start" aria-hidden />
                {t('startMatch')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {played.length > 0 ? (
        <>
          <StandingsCard day={day} teams={teams} />
          <JournalCard day={day} teams={teams} />
        </>
      ) : null}

      {isManager || data.viewer.isHost ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-3">
            <span className="eyebrow text-lamp">{t('managerPanel')}</span>
            <p className="text-muted-foreground text-sm">
              {t('managerNow', {
                name:
                  data.managerParticipantId === null
                    ? t('managerHost')
                    : (data.participants.find((p) => p.id === data.managerParticipantId)?.name ??
                      t('managerHost')),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.viewer.isHost ? (
                <Button type="button" variant="outline" onClick={onAssignManager}>
                  <UserCog className="size-4" aria-hidden /> {t('managerAssign')}
                </Button>
              ) : null}
              {isManager && !finished && played.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run({ kind: 'finishDay' })}
                >
                  <Flag className="size-4" aria-hidden /> {t('finishDay')}
                </Button>
              ) : null}
              {isManager && finished ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run({ kind: 'resumeDay' })}
                >
                  {t('resumeDay')}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

/** Кто за кого играет. Нажатие на игрока переводит его в следующую команду. */
function RosterSection({
  data,
  day,
  teams,
  pending,
  isManager,
  run,
}: {
  data: MatchDayViewData;
  day: MatchDayDto;
  teams: Map<string, DayTeamDto>;
  pending: boolean;
  isManager: boolean;
  run: (command: MatchDayCommand) => void;
}) {
  const t = useTranslations('matchday');

  const teamOf = new Map(day.members.map((member) => [member.participantId, member.teamId]));
  const order = [...teams.values()].sort((a, b) => a.order - b.order);

  const nextTeamId = (current: string | null | undefined): string => {
    const index = order.findIndex((team) => team.id === current);
    const next = order[(index + 1) % Math.max(order.length, 1)];
    return next?.id ?? order[0]?.id ?? '';
  };

  const groups: { team: DayTeamDto | null; players: ParticipantDto[] }[] = [];
  for (const team of order) {
    groups.push({
      team,
      players: data.participants.filter((p) => teamOf.get(p.id) === team.id),
    });
  }
  const loose = data.participants.filter((p) => {
    const teamId = teamOf.get(p.id);
    return teamId === null || teamId === undefined;
  });
  if (loose.length > 0) groups.push({ team: null, players: loose });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="eyebrow text-muted-foreground">{t('roster')}</span>
          {isManager ? (
            <span className="text-muted-foreground text-xs">{t('rosterHint')}</span>
          ) : null}
        </div>

        {groups.map((group) => (
          <div key={group.team?.id ?? 'none'} className="flex flex-col gap-2">
            <span
              className="display text-lg tracking-wide"
              style={{ color: group.team ? teamColorVar(group.team.colorId) : undefined }}
            >
              {group.team?.name ?? t('noTeam')}
            </span>
            {group.players.length === 0 ? (
              <p className="text-muted-foreground text-xs">{t('emptyTeam')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {group.players.map((player) =>
                  isManager ? (
                    <button
                      key={player.id}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run({
                          kind: 'assign',
                          participantId: player.id,
                          teamId: nextTeamId(teamOf.get(player.id)),
                        })
                      }
                      className="border-border hover:border-primary/50 focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {playerName(player)}
                    </button>
                  ) : (
                    <span
                      key={player.id}
                      className="border-border rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      {playerName(player)}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Таблица дня — те же правила, что в «Быстрой игре». */
function StandingsCard({ day, teams }: { day: MatchDayDto; teams: Map<string, DayTeamDto> }) {
  const t = useTranslations('quick.standings');
  const rows = computeStandings(
    day.teams.map((team) => team.id),
    playedResults(day),
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="eyebrow text-muted-foreground">{t('title')}</span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="eyebrow py-1.5 pr-2 font-medium">{t('team')}</th>
                {[t('played'), t('wins'), t('draws'), t('losses')].map((label, index) => (
                  <th key={index} className="eyebrow px-1.5 py-1.5 text-center font-medium">
                    {label}
                  </th>
                ))}
                <th className="eyebrow px-1.5 py-1.5 text-center font-medium">{t('goals')}</th>
                <th className="eyebrow py-1.5 pl-1.5 text-right font-medium">{t('points')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = teams.get(row.teamId);
                if (team === undefined) return null;
                return (
                  <tr key={row.teamId} className="border-b last:border-b-0">
                    <td className="max-w-32 py-2 pr-2">
                      <span
                        className="display truncate text-base tracking-wide"
                        style={{ color: teamColorVar(team.colorId) }}
                      >
                        {team.name}
                      </span>
                    </td>
                    <td className="digits px-1.5 py-2 text-center">{row.played}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.wins}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.draws}</td>
                    <td className="digits px-1.5 py-2 text-center">{row.losses}</td>
                    <td className="digits px-1.5 py-2 text-center whitespace-nowrap">
                      {row.goalsFor}:{row.goalsAgainst}
                    </td>
                    <td className="display digits text-lamp py-2 pl-1.5 text-right text-xl leading-none">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">{t('rules')}</p>
      </CardContent>
    </Card>
  );
}

/** Журнал дня: кто с кем и с каким счётом сыграл. */
function JournalCard({ day, teams }: { day: MatchDayDto; teams: Map<string, DayTeamDto> }) {
  const t = useTranslations('matchday');

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="eyebrow text-muted-foreground">{t('journal')}</span>
        <ul className="flex flex-col">
          {day.matches
            .filter((match) => match.status === 'FINISHED')
            .map((match) => {
              const score = matchScore(match);
              const home = teams.get(match.homeTeamId);
              const away = teams.get(match.awayTeamId);
              return (
                <li
                  key={match.id}
                  className="flex items-baseline gap-2 border-b py-2 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground digits text-xs">#{match.order}</span>
                  <span
                    className="display truncate tracking-wide"
                    style={{ color: teamColorVar(home?.colorId ?? 'paper') }}
                  >
                    {home?.name}
                  </span>
                  <span className="display digits ml-auto text-lg">
                    {score.home}:{score.away}
                  </span>
                  <span
                    className="display truncate tracking-wide"
                    style={{ color: teamColorVar(away?.colorId ?? 'paper') }}
                  >
                    {away?.name}
                  </span>
                </li>
              );
            })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Кому передать протокол: только игроки с кабинетом. */
function ManagerDialog({
  data,
  pending,
  onClose,
  onPick,
}: {
  data: MatchDayViewData;
  pending: boolean;
  onClose: () => void;
  onPick: (participantId: string | null) => void;
}) {
  const t = useTranslations('matchday');
  const candidates = data.participants.filter((p) => p.tag !== null);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('managerTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            aria-pressed={data.managerParticipantId === null}
            onClick={() => onPick(null)}
            className={`focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              data.managerParticipantId === null
                ? 'border-primary bg-primary/10 font-semibold'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {t('managerHost')}
          </button>
          {candidates.map((player) => (
            <button
              key={player.id}
              type="button"
              disabled={pending}
              aria-pressed={data.managerParticipantId === player.id}
              onClick={() => onPick(player.id)}
              className={`focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                data.managerParticipantId === player.id
                  ? 'border-primary bg-primary/10 font-semibold'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {player.name}
              <span className="text-lamp ml-1.5 text-xs">@{player.tag}</span>
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('managerHint')}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
