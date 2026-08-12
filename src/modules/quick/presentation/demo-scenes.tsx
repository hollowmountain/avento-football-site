'use client';

import { ImageDown, Minus, Pencil, Plus, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType, ReactNode } from 'react';
import type { QuickTeamColorId } from '../domain/types';
import { Pill } from '@/shared/ui/pill';
import { TEAM_COLORS, teamColorVar } from './team-colors';

/**
 * Статичные сцены демо-тура: мини-моки экранов «Быстрой игры» в стиле
 * «Табло». Сцена — только иллюстрация: поверх неё лежит вуаль и яркая
 * карточка шага, поэтому вся сцена décor (aria-hidden у родителя).
 */

export type DemoStepKey =
  | 'arrive'
  | 'teams'
  | 'colors'
  | 'kickoff'
  | 'match'
  | 'goal'
  | 'rotation'
  | 'standings'
  | 'journal'
  | 'share';

export const DEMO_STEP_KEYS: readonly DemoStepKey[] = [
  'arrive',
  'teams',
  'colors',
  'kickoff',
  'match',
  'goal',
  'rotation',
  'standings',
  'journal',
  'share',
];

function MockButton({
  children,
  tone = 'outline',
}: {
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'outline';
}) {
  const tones = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border-border bg-background border',
  } as const;
  return (
    <span
      className={`display inline-flex h-8 items-center rounded-lg px-3 text-sm tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function TeamHeader({
  colorId,
  name,
  count,
}: {
  colorId: QuickTeamColorId;
  name: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: teamColorVar(colorId) }}
      />
      <span
        className="display truncate text-sm tracking-wide"
        style={{ color: teamColorVar(colorId) }}
      >
        {name}
      </span>
      {count !== undefined ? (
        <span className="text-muted-foreground digits text-xs">· {count}</span>
      ) : null}
      <Pencil className="text-muted-foreground ml-auto size-3" />
    </div>
  );
}

function PlayerRow({ name, guest, badge }: { name: string; guest?: boolean; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="truncate text-sm font-semibold">{name}</span>
      {guest === true && badge !== undefined ? <Pill>{badge}</Pill> : null}
    </div>
  );
}

function SceneShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card flex h-80 flex-col gap-3 overflow-hidden p-4 sm:h-96">{children}</div>
  );
}

function SceneArrive() {
  const t = useTranslations('quick');
  const names = useTranslations('quick.demo.sample');
  return (
    <SceneShell>
      <p className="display text-lg tracking-wide">{t('roster.title')}</p>
      <div className="flex gap-2">
        <span className="border-input text-muted-foreground flex h-8 flex-1 items-center rounded-lg border px-3 text-sm">
          {t('roster.namePlaceholder')}
        </span>
        <MockButton tone="secondary">{t('roster.add')}</MockButton>
        <MockButton>{t('roster.guest')}</MockButton>
      </div>
      <div className="bg-background/40 rounded-md border">
        <PlayerRow name={names('n1')} />
        <PlayerRow name={names('n2')} />
        <PlayerRow name={names('n3')} />
        <PlayerRow
          name={t('roster.guestAutoName', { number: 1 })}
          guest
          badge={t('roster.guestBadge')}
        />
      </div>
    </SceneShell>
  );
}

function SceneTeams() {
  const t = useTranslations('quick');
  const names = useTranslations('quick.demo.sample');
  return (
    <SceneShell>
      <div className="flex gap-2">
        <MockButton tone="secondary">{t('roster.teams3')}</MockButton>
        <span className="text-muted-foreground self-center text-xs">{t('roster.waitingHint')}</span>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2">
        <div className="bg-background/40 rounded-md border">
          <TeamHeader colorId="amber" name={t('teamDefaults.amber')} count={2} />
          <PlayerRow name={names('n1')} />
          <PlayerRow name={names('n2')} />
        </div>
        <div className="bg-background/40 rounded-md border">
          <TeamHeader colorId="green" name={t('teamDefaults.green')} count={2} />
          <PlayerRow name={names('n3')} />
          <PlayerRow name={names('n4')} />
        </div>
        <div className="bg-background/40 rounded-md border">
          <TeamHeader colorId="coral" name={t('teamDefaults.coral')} count={2} />
          <PlayerRow name={names('n5')} />
          <PlayerRow name={names('n6')} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t('roster.tapHint')}</p>
    </SceneShell>
  );
}

function SceneColors() {
  const t = useTranslations('quick');
  return (
    <SceneShell>
      <div className="bg-background/40 mx-auto w-64 rounded-md border">
        <TeamHeader colorId="sky" name={t('teamDefaults.sky')} count={4} />
      </div>
      <div className="bg-popover mx-auto flex w-64 flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
        <p className="display text-base tracking-wide">{t('team.editTitle')}</p>
        <span className="border-input flex h-8 items-center rounded-lg border px-3 text-sm">
          {t('teamDefaults.sky')}
        </span>
        <div className="flex flex-wrap gap-2">
          {TEAM_COLORS.map((preset) => (
            <span
              key={preset.id}
              className={`size-7 rounded-full border ${
                preset.id === 'sky' ? 'border-foreground ring-2 ring-offset-2' : 'border-border'
              }`}
              style={{ background: teamColorVar(preset.id) }}
            />
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

function SceneKickoff() {
  const t = useTranslations('quick');
  return (
    <SceneShell>
      <p className="display text-lg tracking-wide">{t('kickoff.chooseTitle')}</p>
      <div className="flex flex-col items-start gap-2">
        {(
          [
            ['amber', 'green', true],
            ['amber', 'coral', false],
            ['green', 'coral', false],
          ] as const
        ).map(([a, b, active]) => (
          <span
            key={`${a}-${b}`}
            className={`display rounded-md border px-3 py-1.5 text-sm tracking-wide ${
              active ? 'border-primary bg-primary/10' : 'border-border'
            }`}
          >
            <span style={{ color: teamColorVar(a) }}>{t(`teamDefaults.${a}`)}</span>
            <span className="text-muted-foreground mx-1.5">—</span>
            <span style={{ color: teamColorVar(b) }}>{t(`teamDefaults.${b}`)}</span>
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t('kickoff.autoSub')}</p>
      <MockButton tone="primary">{t('kickoff.start')}</MockButton>
    </SceneShell>
  );
}

function SceneMatch() {
  const t = useTranslations('quick');
  return (
    <SceneShell>
      <p className="display digits text-center text-5xl">07:42</p>
      <div className="mx-auto flex justify-center gap-2">
        <MockButton>{t('match.timerPause')}</MockButton>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center">
          <span className="display text-sm" style={{ color: teamColorVar('amber') }}>
            {t('teamDefaults.amber')}
          </span>
          <span className="display digits text-7xl">2</span>
        </div>
        <span className="display text-muted-foreground text-5xl">:</span>
        <div className="flex flex-col items-center">
          <span className="display text-sm" style={{ color: teamColorVar('green') }}>
            {t('teamDefaults.green')}
          </span>
          <span className="display digits text-7xl">1</span>
        </div>
      </div>
      <p className="text-muted-foreground text-center text-xs">{t('match.scoreHint')}</p>
    </SceneShell>
  );
}

function SceneGoal() {
  const t = useTranslations('quick');
  const names = useTranslations('quick.demo.sample');
  return (
    <SceneShell>
      <div className="bg-popover mx-auto flex w-72 flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
        <p className="display text-lg tracking-wide">{t('goalDialog.title')}</p>
        <p className="text-sm font-medium">{t('goalDialog.scorer')}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="border-border rounded-md border px-2.5 py-1 text-sm">
            {t('goalDialog.noScorer')}
          </span>
          <span className="border-primary bg-primary/10 rounded-md border px-2.5 py-1 text-sm font-semibold">
            {names('n1')}
          </span>
          <span className="border-border rounded-md border px-2.5 py-1 text-sm">{names('n2')}</span>
        </div>
        <p className="text-sm font-medium">{t('goalDialog.assist')}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="border-border rounded-md border px-2.5 py-1 text-sm">
            {t('goalDialog.noAssist')}
          </span>
          <span className="border-border rounded-md border px-2.5 py-1 text-sm">{names('n2')}</span>
        </div>
        <MockButton tone="primary">{t('goalDialog.save')}</MockButton>
      </div>
    </SceneShell>
  );
}

function SceneRotation() {
  const t = useTranslations('quick');
  return (
    <SceneShell>
      <div className="bg-popover mx-auto flex w-80 max-w-full flex-col gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
        <p className="display text-lg tracking-wide">{t('match.finishTitle')}</p>
        <p className="display digits text-2xl">
          <span style={{ color: teamColorVar('amber') }}>{t('teamDefaults.amber')}</span> 2:1{' '}
          <span style={{ color: teamColorVar('green') }}>{t('teamDefaults.green')}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          {t('match.outcomeWin', {
            winner: t('teamDefaults.amber'),
            loser: t('teamDefaults.green'),
          })}
        </p>
        <p className="text-muted-foreground text-sm">
          {t('match.entering', { team: t('teamDefaults.coral') })}
        </p>
        <MockButton tone="primary">{t('match.confirm')}</MockButton>
      </div>
    </SceneShell>
  );
}

function SceneStandings() {
  const t = useTranslations('quick');
  const rows = [
    {
      colorId: 'amber' as const,
      name: t('teamDefaults.amber'),
      record: '2 · 1 · 0',
      goals: '6:3',
      points: 7,
    },
    {
      colorId: 'coral' as const,
      name: t('teamDefaults.coral'),
      record: '1 · 1 · 1',
      goals: '4:4',
      points: 4,
    },
    {
      colorId: 'green' as const,
      name: t('teamDefaults.green'),
      record: '0 · 0 · 3',
      goals: '2:5',
      points: 0,
    },
  ];
  return (
    <SceneShell>
      <p className="display text-lg tracking-wide">{t('standings.title')}</p>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.colorId} className="flex items-center gap-2 border-b py-2 last:border-b-0">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: teamColorVar(row.colorId) }}
            />
            <span
              className="display flex-1 truncate text-base tracking-wide"
              style={{ color: teamColorVar(row.colorId) }}
            >
              {row.name}
            </span>
            <span className="digits text-muted-foreground text-xs">{row.record}</span>
            <span className="digits text-muted-foreground text-xs">{row.goals}</span>
            <span className="display digits text-lamp w-7 text-right text-xl">{row.points}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t('standings.rules')}</p>
    </SceneShell>
  );
}

function SceneJournal() {
  const t = useTranslations('quick');
  const matches = [
    { n: 1, a: 'amber' as const, b: 'green' as const, sa: 2, sb: 1 },
    { n: 2, a: 'amber' as const, b: 'coral' as const, sa: 1, sb: 1 },
  ];
  return (
    <SceneShell>
      <p className="display text-lg tracking-wide">{t('journal.title')}</p>
      {matches.map((match) => (
        <div key={match.n} className="bg-background/40 rounded-md border p-2.5">
          <p className="eyebrow text-muted-foreground mb-1">
            {t('journal.matchNumber', { number: match.n })}
          </p>
          {(
            [
              [match.a, match.sa],
              [match.b, match.sb],
            ] as const
          ).map(([colorId, score]) => (
            <div key={colorId} className="flex items-center gap-2 py-0.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: teamColorVar(colorId) }}
              />
              <span
                className="display flex-1 text-sm tracking-wide"
                style={{ color: teamColorVar(colorId) }}
              >
                {t(`teamDefaults.${colorId}`)}
              </span>
              <span className="border-border flex size-5 items-center justify-center rounded border">
                <Minus className="size-3" />
              </span>
              <span className="display digits w-5 text-center text-lg">{score}</span>
              <span className="border-border flex size-5 items-center justify-center rounded border">
                <Plus className="size-3" />
              </span>
            </div>
          ))}
        </div>
      ))}
      <p className="text-muted-foreground text-xs">{t('journal.editHint')}</p>
    </SceneShell>
  );
}

function SceneShare() {
  const t = useTranslations('quick');
  return (
    <SceneShell>
      <div
        className="mx-auto flex w-52 flex-col gap-2 rounded-lg p-4"
        style={{ background: '#0d1013' }}
      >
        <span className="eyebrow" style={{ color: '#ffb020' }}>
          {t('share.cardEyebrow')}
        </span>
        <span className="display text-2xl tracking-wide" style={{ color: '#f2ede3' }}>
          {t('share.cardTitle')}
        </span>
        {(
          [
            ['#ffb020', 7],
            ['#f0616b', 4],
            ['#5fd98c', 0],
          ] as const
        ).map(([color, points]) => (
          <span
            key={color}
            className="flex items-center justify-between border-t pt-1.5"
            style={{ borderColor: '#262d33' }}
          >
            <span
              className="display h-3 w-20 rounded-sm"
              style={{ background: color, opacity: 0.85 }}
            />
            <span className="display digits text-lg" style={{ color: '#ffb020' }}>
              {points}
            </span>
          </span>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <MockButton tone="secondary">
          <Share2 className="mr-1.5 size-3.5" />
          {t('share.text')}
        </MockButton>
        <MockButton>
          <ImageDown className="mr-1.5 size-3.5" />
          {t('share.card')}
        </MockButton>
      </div>
    </SceneShell>
  );
}

export const DEMO_SCENES: Record<DemoStepKey, ComponentType> = {
  arrive: SceneArrive,
  teams: SceneTeams,
  colors: SceneColors,
  kickoff: SceneKickoff,
  match: SceneMatch,
  goal: SceneGoal,
  rotation: SceneRotation,
  standings: SceneStandings,
  journal: SceneJournal,
  share: SceneShare,
};
