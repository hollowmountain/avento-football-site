'use client';

import { Pause, Play, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { QuickPlayer, QuickTeam, QuickTeamColorId } from '../domain/types';
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
import { Pill } from '@/shared/ui/pill';
import {
  addGoal,
  finishMatch,
  liveScore,
  toggleTimer,
  undoLastGoal,
  type LiveMatch,
  type QuickDay,
} from './quick-day-store';
import { teamColorVar } from './team-colors';

/** Экран идущего матча: таймер, большой счёт, голы и завершение. */
export function MatchScreen({ day, live }: { day: QuickDay; live: LiveMatch }) {
  const t = useTranslations('quick.match');
  const [goalTeamId, setGoalTeamId] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const home = teamById.get(live.homeId);
  const away = teamById.get(live.awayId);
  const score = liveScore(live);
  const goalTeam = goalTeamId !== null ? (teamById.get(goalTeamId) ?? null) : null;

  if (home === undefined || away === undefined) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Pill tone="accent">{t('number', { number: day.matches.length + 1 })}</Pill>
      </div>

      <MatchTimer live={live} />

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
                  </div>
                ),
            )}
          </div>
          <p className="text-muted-foreground text-center text-xs">{t('scoreHint')}</p>
        </CardContent>
      </Card>

      <GoalsFeed day={day} live={live} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={live.goals.length === 0}
          onClick={() => undoLastGoal()}
        >
          <Undo2 data-icon="inline-start" aria-hidden />
          {t('undo')}
        </Button>
        <Button
          type="button"
          className="display ml-auto text-base tracking-wide"
          onClick={() => setFinishOpen(true)}
        >
          {t('finish')}
        </Button>
      </div>

      {goalTeam !== null ? (
        <GoalDialog
          team={goalTeam}
          players={day.players.filter((player) => player.teamId === goalTeam.id)}
          onClose={() => setGoalTeamId(null)}
        />
      ) : null}

      {finishOpen ? (
        <FinishDialog day={day} live={live} onClose={() => setFinishOpen(false)} />
      ) : null}
    </section>
  );
}

function MatchTimer({ live }: { live: LiveMatch }) {
  const t = useTranslations('quick.match');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live.timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [live.timer.running]);

  const elapsedMs =
    live.timer.accumulatedMs +
    (live.timer.running ? Math.max(0, now - (live.timer.startedAt ?? now)) : 0);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-4">
      <time className="display digits text-6xl leading-none sm:text-7xl" aria-live="off">
        {minutes}:{seconds}
      </time>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => {
          // Пауза фиксирует накопленное время немедленно, без ожидания тика
          setNow(Date.now());
          toggleTimer();
        }}
      >
        {live.timer.running ? (
          <Pause data-icon="inline-start" aria-hidden />
        ) : (
          <Play data-icon="inline-start" aria-hidden />
        )}
        {live.timer.running ? t('timerPause') : t('timerStart')}
      </Button>
    </div>
  );
}

function GoalsFeed({ day, live }: { day: QuickDay; live: LiveMatch }) {
  const t = useTranslations('quick.match');
  const playerById = new Map(day.players.map((player) => [player.id, player]));
  const teamById = new Map(day.teams.map((team) => [team.id, team]));

  if (live.goals.length === 0) {
    return <p className="text-muted-foreground text-center text-sm">{t('noGoals')}</p>;
  }

  const rows: {
    id: string;
    score: string;
    colorId: QuickTeamColorId;
    scorerName: string;
    assistName: string | null;
  }[] = [];
  let home = 0;
  let away = 0;
  for (const goal of live.goals) {
    if (goal.teamId === live.homeId) home += 1;
    else if (goal.teamId === live.awayId) away += 1;
    const scorer = goal.scorerId !== null ? playerById.get(goal.scorerId) : undefined;
    const assist = goal.assistId !== null ? playerById.get(goal.assistId) : undefined;
    rows.push({
      id: goal.id,
      score: `${home}:${away}`,
      colorId: teamById.get(goal.teamId)?.colorId ?? 'paper',
      scorerName: scorer?.name ?? t('noScorer'),
      assistName: assist?.name ?? null,
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
              style={{ background: teamColorVar(row.colorId) }}
              aria-hidden
            />
            <span className="digits text-muted-foreground">{row.score}</span>
            <span className="font-semibold">{row.scorerName}</span>
            {row.assistName !== null ? (
              <span className="text-muted-foreground text-xs">
                {t('assist', { name: row.assistName })}
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
  players,
  onClose,
}: {
  team: QuickTeam;
  players: QuickPlayer[];
  onClose: () => void;
}) {
  const t = useTranslations('quick.goalDialog');
  const tRoster = useTranslations('quick.roster');
  const [scorerId, setScorerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);

  const save = () => {
    addGoal(team.id, scorerId, scorerId !== null ? assistId : null);
    onClose();
  };

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
            players={players}
            selectedId={scorerId}
            noneLabel={t('noScorer')}
            guestBadge={tRoster('guestBadge')}
            onSelect={(id) => {
              setScorerId(id);
              if (id === null || id === assistId) setAssistId(null);
            }}
          />
          {scorerId !== null && players.length > 1 ? (
            <PlayerPicker
              legend={t('assist')}
              players={players.filter((player) => player.id !== scorerId)}
              selectedId={assistId}
              noneLabel={t('noAssist')}
              guestBadge={tRoster('guestBadge')}
              onSelect={setAssistId}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={save}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayerPicker({
  legend,
  players,
  selectedId,
  noneLabel,
  guestBadge,
  onSelect,
}: {
  legend: string;
  players: QuickPlayer[];
  selectedId: string | null;
  noneLabel: string;
  guestBadge: string;
  onSelect: (id: string | null) => void;
}) {
  const options: { id: string | null; label: string; guest: boolean }[] = [
    { id: null, label: noneLabel, guest: false },
    ...players.map((player) => ({ id: player.id, label: player.name, guest: player.guest })),
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
            {option.guest ? <Pill>{guestBadge}</Pill> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FinishDialog({
  day,
  live,
  onClose,
}: {
  day: QuickDay;
  live: LiveMatch;
  onClose: () => void;
}) {
  const t = useTranslations('quick.match');
  const [drawLoserId, setDrawLoserId] = useState<string | null>(null);
  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const home = teamById.get(live.homeId);
  const away = teamById.get(live.awayId);
  const score = liveScore(live);

  const nameOf = (id: string | undefined | null) =>
    id !== null && id !== undefined ? (teamById.get(id)?.name ?? '') : '';

  const hasQueue = day.rotation !== null && day.rotation.waiting.length > 0;
  const isDraw = score.home === score.away;
  // Ничью счёт не решает: команды играют суефа, проигравшего отмечаем здесь
  const needsRps = hasQueue && isDraw;
  const entering = hasQueue ? nameOf(day.rotation?.waiting[0]) : '';

  let outcome: string | null = null;
  if (!hasQueue) {
    outcome = t('outcomeStay');
  } else if (!isDraw) {
    const winnerId = score.home > score.away ? live.homeId : live.awayId;
    const loserId = winnerId === live.homeId ? live.awayId : live.homeId;
    outcome = t('outcomeWin', { winner: nameOf(winnerId), loser: nameOf(loserId) });
  } else if (drawLoserId !== null) {
    const stayingId = drawLoserId === live.homeId ? live.awayId : live.homeId;
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
                <span
                  style={{ color: home !== undefined ? teamColorVar(home.colorId) : undefined }}
                >
                  {home?.name}
                </span>{' '}
                {score.home}:{score.away}{' '}
                <span
                  style={{ color: away !== undefined ? teamColorVar(away.colorId) : undefined }}
                >
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
            onClick={() => {
              finishMatch(drawLoserId ?? undefined);
              onClose();
            }}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
