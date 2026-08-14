'use client';

import { Pause, Play, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { teamColorVar } from '@/modules/quick/presentation/team-colors';
import { useHydrated } from '@/shared/hooks/use-hydrated';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { matchScore } from '../domain/matchday';
import type { MatchDayCommand } from '../application/matchday';
import type { ParticipantDto } from './dto';
import type { DayMatchDto, DayTeamDto, MatchDayDto } from './matchday-dto';

/**
 * Экран идущего матча — тот же, что в «Быстрой игре», но состояние
 * приходит с сервера: смотреть может любой, нажимать — только менеджер.
 */
export function MatchDayMatch({
  day,
  match,
  teams,
  participants,
  isManager,
  pending,
  run,
}: {
  day: MatchDayDto;
  match: DayMatchDto;
  teams: Map<string, DayTeamDto>;
  participants: ParticipantDto[];
  isManager: boolean;
  pending: boolean;
  run: (command: MatchDayCommand) => void;
}) {
  const t = useTranslations('quick.match');
  const tDay = useTranslations('matchday');
  const [goalTeamId, setGoalTeamId] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const score = matchScore(match);
  const goalTeam = goalTeamId === null ? null : (teams.get(goalTeamId) ?? null);

  if (home === undefined || away === undefined) return null;

  const squadOf = (teamId: string) => {
    const ids = new Set(day.members.filter((m) => m.teamId === teamId).map((m) => m.participantId));
    return participants.filter((p) => ids.has(p.id));
  };

  return (
    <section className="flex flex-col gap-4">
      <MatchTimer match={match} isManager={isManager} pending={pending} run={run} />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {[{ team: home, value: score.home }, null, { team: away, value: score.away }].map(
              (cell, index) =>
                cell === null ? (
                  <span
                    key="colon"
                    className="display text-muted-foreground text-5xl sm:text-6xl"
                    aria-hidden
                  >
                    :
                  </span>
                ) : (
                  <div key={cell.team.id} className="flex min-w-0 flex-col items-center gap-1">
                    <span
                      className="display max-w-full truncate text-lg tracking-wide"
                      style={{ color: teamColorVar(cell.team.colorId) }}
                    >
                      {cell.team.name}
                    </span>
                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => setGoalTeamId(cell.team.id)}
                        aria-label={t('goalFor', { team: cell.team.name })}
                        className={`display digits hover:border-primary/60 focus-visible:ring-ring w-full rounded-md border border-transparent px-2 text-7xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-8xl ${
                          index === 0 ? 'justify-self-end' : 'justify-self-start'
                        }`}
                      >
                        {cell.value}
                      </button>
                    ) : (
                      <span className="display digits px-2 text-7xl leading-none sm:text-8xl">
                        {cell.value}
                      </span>
                    )}
                  </div>
                ),
            )}
          </div>
          <p className="text-muted-foreground text-center text-xs">
            {isManager ? t('scoreHint') : tDay('watchHint')}
          </p>
        </CardContent>
      </Card>

      <GoalsFeed match={match} teams={teams} participants={participants} />

      {isManager ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={match.goals.length === 0 || pending}
            onClick={() => run({ kind: 'undoGoal' })}
          >
            <Undo2 data-icon="inline-start" aria-hidden />
            {t('undo')}
          </Button>
          <Button
            type="button"
            className="display ml-auto text-base tracking-wide"
            disabled={pending}
            onClick={() => setFinishOpen(true)}
          >
            {t('finish')}
          </Button>
        </div>
      ) : null}

      {goalTeam !== null ? (
        <GoalDialog
          team={goalTeam}
          squad={squadOf(goalTeam.id)}
          onClose={() => setGoalTeamId(null)}
          onSave={(scorerParticipantId, assistParticipantId) => {
            run({ kind: 'goal', teamId: goalTeam.id, scorerParticipantId, assistParticipantId });
            setGoalTeamId(null);
          }}
        />
      ) : null}

      {finishOpen ? (
        <FinishDialog
          day={day}
          match={match}
          teams={teams}
          onClose={() => setFinishOpen(false)}
          onConfirm={(drawLoserTeamId) => {
            run({ kind: 'finishMatch', drawLoserTeamId });
            setFinishOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function MatchTimer({
  match,
  isManager,
  pending,
  run,
}: {
  match: DayMatchDto;
  isManager: boolean;
  pending: boolean;
  run: (command: MatchDayCommand) => void;
}) {
  const t = useTranslations('quick.match');
  const [now, setNow] = useState(() => Date.now());
  // До гидратации показываем только накопленное время: на сервере и на
  // клиенте секунды всё равно разные, и разметка бы разошлась
  const hydrated = useHydrated();

  useEffect(() => {
    if (!match.timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [match.timer.running]);

  const startedAtMs = match.timer.startedAt === null ? null : Date.parse(match.timer.startedAt);
  const elapsedMs =
    match.timer.accumulatedMs +
    (hydrated && match.timer.running && startedAtMs !== null ? Math.max(0, now - startedAtMs) : 0);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-4">
      <time className="display digits text-6xl leading-none sm:text-7xl" aria-live="off">
        {minutes}:{seconds}
      </time>
      {isManager ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() => {
            // Пауза фиксирует накопленное немедленно, не дожидаясь тика
            setNow(Date.now());
            run({ kind: 'timer', running: !match.timer.running });
          }}
        >
          {match.timer.running ? (
            <Pause data-icon="inline-start" aria-hidden />
          ) : (
            <Play data-icon="inline-start" aria-hidden />
          )}
          {match.timer.running ? t('timerPause') : t('timerStart')}
        </Button>
      ) : null}
    </div>
  );
}

function GoalsFeed({
  match,
  teams,
  participants,
}: {
  match: DayMatchDto;
  teams: Map<string, DayTeamDto>;
  participants: ParticipantDto[];
}) {
  const t = useTranslations('quick.match');
  const byId = new Map(participants.map((p) => [p.id, p]));

  if (match.goals.length === 0) {
    return <p className="text-muted-foreground text-center text-sm">{t('noGoals')}</p>;
  }

  const rows: {
    id: string;
    score: string;
    color: string;
    scorer: string;
    assist: string | null;
  }[] = [];
  let home = 0;
  let away = 0;
  for (const goal of match.goals) {
    if (goal.teamId === match.homeTeamId) home += 1;
    else if (goal.teamId === match.awayTeamId) away += 1;
    const scorer = goal.scorerParticipantId === null ? null : byId.get(goal.scorerParticipantId);
    const assist = goal.assistParticipantId === null ? null : byId.get(goal.assistParticipantId);
    rows.push({
      id: goal.id,
      score: `${home}:${away}`,
      color: teamColorVar(teams.get(goal.teamId)?.colorId ?? 'paper'),
      scorer: scorer === undefined || scorer === null ? t('noScorer') : playerName(scorer),
      assist: assist === undefined || assist === null ? null : playerName(assist),
    });
  }

  return (
    <div>
      <p className="eyebrow text-muted-foreground mb-1.5">{t('goalsTitle')}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-2 text-sm">
            <span
              className="size-2 shrink-0 self-center rounded-full"
              style={{ background: row.color }}
              aria-hidden
            />
            <span className="digits text-muted-foreground">{row.score}</span>
            <span className="font-semibold">{row.scorer}</span>
            {row.assist !== null ? (
              <span className="text-muted-foreground text-xs">
                {t('assist', { name: row.assist })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalDialog({
  team,
  squad,
  onClose,
  onSave,
}: {
  team: DayTeamDto;
  squad: ParticipantDto[];
  onClose: () => void;
  onSave: (scorerParticipantId: string | null, assistParticipantId: string | null) => void;
}) {
  const t = useTranslations('quick.goalDialog');
  const [scorerId, setScorerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('title')}</DialogTitle>
          <DialogDescription>
            <span style={{ color: teamColorVar(team.colorId) }} className="font-semibold">
              {team.name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <PlayerPicker
            legend={t('scorer')}
            players={squad}
            selectedId={scorerId}
            noneLabel={t('noScorer')}
            onSelect={(id) => {
              setScorerId(id);
              if (id === null || id === assistId) setAssistId(null);
            }}
          />
          {scorerId !== null && squad.length > 1 ? (
            <PlayerPicker
              legend={t('assist')}
              players={squad.filter((p) => p.id !== scorerId)}
              selectedId={assistId}
              noneLabel={t('noAssist')}
              onSelect={setAssistId}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onSave(scorerId, scorerId === null ? null : assistId)}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Выбор игрока по тегу кабинета — гола «в никуда» больше не случается. */
function PlayerPicker({
  legend,
  players,
  selectedId,
  noneLabel,
  onSelect,
}: {
  legend: string;
  players: ParticipantDto[];
  selectedId: string | null;
  noneLabel: string;
  onSelect: (id: string | null) => void;
}) {
  const options: { id: string | null; label: string }[] = [
    { id: null, label: noneLabel },
    ...players.map((player) => ({ id: player.id, label: playerName(player) })),
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id ?? 'none'}
            type="button"
            aria-pressed={selectedId === option.id}
            onClick={() => onSelect(option.id)}
            className={`focus-visible:ring-ring flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              selectedId === option.id
                ? 'border-primary bg-primary/10 font-semibold'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FinishDialog({
  day,
  match,
  teams,
  onClose,
  onConfirm,
}: {
  day: MatchDayDto;
  match: DayMatchDto;
  teams: Map<string, DayTeamDto>;
  onClose: () => void;
  onConfirm: (drawLoserTeamId: string | null) => void;
}) {
  const t = useTranslations('quick.match');
  const [drawLoserId, setDrawLoserId] = useState<string | null>(null);

  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const score = matchScore(match);
  const nameOf = (id: string | undefined | null) =>
    id === undefined || id === null ? '' : (teams.get(id)?.name ?? '');

  const hasQueue = day.rotation !== null && day.rotation.waiting.length > 0;
  const isDraw = score.home === score.away;
  const needsRps = hasQueue && isDraw;
  const entering = hasQueue ? nameOf(day.rotation?.waiting[0]) : '';

  let outcome: string | null = null;
  if (!hasQueue) {
    outcome = t('outcomeStay');
  } else if (!isDraw) {
    const winnerId = score.home > score.away ? match.homeTeamId : match.awayTeamId;
    const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    outcome = t('outcomeWin', { winner: nameOf(winnerId), loser: nameOf(loserId) });
  } else if (drawLoserId !== null) {
    const stayingId = drawLoserId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    outcome = t('outcomeWin', { winner: nameOf(stayingId), loser: nameOf(drawLoserId) });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('finishTitle')}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-1">
              <span className="display digits text-foreground text-3xl">
                <span style={{ color: home ? teamColorVar(home.colorId) : undefined }}>
                  {home?.name}
                </span>{' '}
                {score.home}:{score.away}{' '}
                <span style={{ color: away ? teamColorVar(away.colorId) : undefined }}>
                  {away?.name}
                </span>
              </span>
              {needsRps ? <span>{t('drawPrompt')}</span> : null}
              {outcome !== null ? <span>{outcome}</span> : null}
              {outcome !== null && entering !== '' ? (
                <span>{t('entering', { team: entering })}</span>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {needsRps ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">{t('drawPick')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[home, away].map((team) =>
                team === undefined ? null : (
                  <button
                    key={team.id}
                    type="button"
                    aria-pressed={drawLoserId === team.id}
                    onClick={() => setDrawLoserId(team.id)}
                    className={`display focus-visible:ring-ring rounded-md border px-3 py-1.5 text-base tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      drawLoserId === team.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ color: teamColorVar(team.colorId) }}
                  >
                    {team.name}
                  </button>
                ),
              )}
            </div>
          </fieldset>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={needsRps && drawLoserId === null}
            onClick={() => onConfirm(drawLoserId)}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** В составе игры у всех с кабинетом есть тег — по нему и узнают друг друга. */
export function playerName(participant: ParticipantDto): string {
  return participant.tag !== null ? participant.name : participant.nickname;
}
