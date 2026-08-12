'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { defaultTeams } from './default-teams';
import { JournalSection } from './journal-section';
import { KickoffSection } from './kickoff-section';
import { MatchScreen } from './match-screen';
import {
  finishDay,
  resetDay,
  resumeDay,
  startDay,
  useQuickDay,
  type QuickDay,
} from './quick-day-store';
import { RosterSection } from './roster-section';
import { ShareSection } from './share-section';
import { StandingsSection } from './standings-section';

/** Режим «Быстрая игра»: весь день живёт на устройстве, бэкенда нет. */
export function QuickClient() {
  const day = useQuickDay();

  // До гидратации не знаем, идёт ли день — держим место без мигания экранов
  if (day === undefined) return <div className="min-h-64" aria-busy="true" />;
  if (day === null) return <IntroScreen />;
  if (day.live !== null) return <MatchScreen day={day} live={day.live} />;
  if (day.finishedAt != null) return <FinishedScreen day={day} />;
  return <DayScreen day={day} />;
}

function IntroScreen() {
  const t = useTranslations('quick');
  const tDefaults = useTranslations('quick.teamDefaults');

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 py-14 text-center">
      <p className="eyebrow text-lamp">{t('intro.storageHint')}</p>
      <h1 className="display text-6xl leading-none tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground text-base">{t('intro.lead')}</p>
      <Button
        type="button"
        size="lg"
        className="display h-11 px-6 text-lg tracking-wide"
        onClick={() => startDay(defaultTeams((colorId) => tDefaults(colorId), 2))}
      >
        {t('intro.start')}
      </Button>
      <Button asChild variant="link" className="text-muted-foreground">
        <Link href="/quick/demo">{t('intro.demo')}</Link>
      </Button>
    </section>
  );
}

function DayScreen({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.day');
  const format = useFormatter();
  const [resetOpen, setResetOpen] = useState(false);
  const hasMatches = day.matches.length > 0;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="display text-3xl leading-none tracking-tight">{t('title')}</h1>
        <span className="text-muted-foreground text-sm">
          {format.dateTime(new Date(day.startedAt), { day: 'numeric', month: 'long' })}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {hasMatches ? (
            <Button type="button" variant="outline" size="sm" onClick={() => finishDay()}>
              {t('finish')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setResetOpen(true)}
          >
            {t('reset')}
          </Button>
        </span>
      </header>

      <RosterSection day={day} />
      <KickoffSection day={day} />
      {hasMatches ? (
        <>
          <StandingsSection day={day} />
          <JournalSection day={day} />
          <ShareSection day={day} />
        </>
      ) : null}

      {resetOpen ? <ResetDialog onClose={() => setResetOpen(false)} /> : null}
    </section>
  );
}

/** День завершён: только итоги, журнал и шаринг — состав больше не трогаем. */
function FinishedScreen({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.day');
  const format = useFormatter();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="display text-3xl leading-none tracking-tight">{t('resultsTitle')}</h1>
        <span className="text-muted-foreground text-sm">
          {format.dateTime(new Date(day.startedAt), { day: 'numeric', month: 'long' })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground ml-auto"
          onClick={() => resumeDay()}
        >
          {t('resume')}
        </Button>
      </header>

      <StandingsSection day={day} />
      <JournalSection day={day} />
      <ShareSection day={day} />

      <Button
        type="button"
        variant="outline"
        className="display self-start text-base tracking-wide"
        onClick={() => setResetOpen(true)}
      >
        {t('newDay')}
      </Button>

      {resetOpen ? <ResetDialog onClose={() => setResetOpen(false)} /> : null}
    </section>
  );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('quick.day');
  const tCommon = useTranslations('common');

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('resetTitle')}</DialogTitle>
          <DialogDescription>{t('resetText')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={() => resetDay()}>
            {t('resetAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
