'use client';

import { Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuickPlayer, QuickTeam } from '../domain/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Pill } from '@/shared/ui/pill';
import {
  addPlayer,
  movePlayerToNextTeam,
  removePlayer,
  renameTeam,
  setTeamColor,
  setTeamCount,
  type QuickDay,
} from './quick-day-store';
import { TEAM_COLORS, teamColorVar } from './team-colors';

/** «Кто пришёл»: добавление игроков и раскладка по командам нажатием. */
export function RosterSection({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.roster');
  const tTeam = useTranslations('quick.team');
  const tDefaults = useTranslations('quick.teamDefaults');
  const [name, setName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const submit = (guest: boolean) => {
    const trimmed = name.trim();
    const guestNumber = day.players.filter((p) => p.guest).length + 1;
    const finalName =
      trimmed !== '' ? trimmed : guest ? t('guestAutoName', { number: guestNumber }) : '';
    if (finalName === '') return;
    addPlayer(finalName, guest);
    setName('');
  };

  // Состав дня фиксируется первым матчем: дальше число команд не переключить
  const canSwitchTeams = day.matches.length === 0 && day.live === null;
  const editingTeam = day.teams.find((team) => team.id === editingTeamId) ?? null;

  const switchTo = (count: 2 | 3 | 4) => {
    const usedColors = new Set(day.teams.map((team) => team.colorId));
    const extras = TEAM_COLORS.filter((preset) => !usedColors.has(preset.id)).map((preset) => ({
      name: tDefaults(preset.id),
      colorId: preset.id,
    }));
    setTeamCount(count, extras);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            className="min-w-40 flex-1"
            maxLength={30}
          />
          <Button type="submit" variant="secondary" disabled={name.trim() === ''}>
            {t('add')}
          </Button>
          <Button type="button" variant="outline" onClick={() => submit(true)}>
            {t('guest')}
          </Button>
        </form>

        {canSwitchTeams ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group">
            {([2, 3, 4] as const).map((count) => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={day.teams.length === count ? 'secondary' : 'ghost'}
                aria-pressed={day.teams.length === count}
                onClick={() => switchTo(count)}
              >
                {t(`teams${count}`)}
              </Button>
            ))}
            {day.teams.length >= 3 ? (
              <span className="text-muted-foreground ml-1 text-xs">{t('waitingHint')}</span>
            ) : null}
          </div>
        ) : null}

        {day.players.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <>
            <div
              className={`grid gap-3 ${
                day.teams.length === 3
                  ? 'sm:grid-cols-3'
                  : day.teams.length === 4
                    ? 'sm:grid-cols-2 lg:grid-cols-4'
                    : 'sm:grid-cols-2'
              }`}
            >
              {day.teams.map((team) => (
                <TeamColumn
                  key={team.id}
                  team={team}
                  members={day.players.filter((player) => player.teamId === team.id)}
                  onEdit={() => setEditingTeamId(team.id)}
                  editLabel={tTeam('edit', { team: team.name })}
                  removeLabel={(playerName) => t('remove', { name: playerName })}
                  guestBadge={t('guestBadge')}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t('tapHint')}</p>
          </>
        )}
      </CardContent>

      {editingTeam !== null ? (
        <TeamEditDialog team={editingTeam} onClose={() => setEditingTeamId(null)} />
      ) : null}
    </Card>
  );
}

function TeamColumn({
  team,
  members,
  onEdit,
  editLabel,
  removeLabel,
  guestBadge,
}: {
  team: QuickTeam;
  members: QuickPlayer[];
  onEdit: () => void;
  editLabel: string;
  removeLabel: (playerName: string) => string;
  guestBadge: string;
}) {
  return (
    <div className="bg-background/40 rounded-md border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: teamColorVar(team.colorId) }}
          aria-hidden
        />
        <span
          className="display truncate text-base tracking-wide"
          style={{ color: teamColorVar(team.colorId) }}
        >
          {team.name}
        </span>
        <span className="text-muted-foreground digits text-xs">· {members.length}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={onEdit}
          aria-label={editLabel}
        >
          <Pencil aria-hidden />
        </Button>
      </div>
      <ul className="flex min-h-10 flex-col p-1.5">
        {members.map((player) => (
          <li key={player.id} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => movePlayerToNextTeam(player.id)}
              className="hover:bg-secondary/60 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="truncate text-sm font-semibold">{player.name}</span>
              {player.guest ? <Pill>{guestBadge}</Pill> : null}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground shrink-0"
              onClick={() => removePlayer(player.id)}
              aria-label={removeLabel(player.name)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamEditDialog({ team, onClose }: { team: QuickTeam; onClose: () => void }) {
  const t = useTranslations('quick.team');
  const tColors = useTranslations('quick.colors');
  const [draftName, setDraftName] = useState(team.name);

  const commit = () => {
    const trimmed = draftName.trim();
    if (trimmed !== '' && trimmed !== team.name) renameTeam(team.id, trimmed);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : commit())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-team-name">{t('nameLabel')}</Label>
            <Input
              id="quick-team-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={20}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('colorLabel')}</span>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTeamColor(team.id, preset.id)}
                  aria-label={tColors(preset.id)}
                  aria-pressed={team.colorId === preset.id}
                  className={`focus-visible:ring-ring size-8 rounded-full border transition-transform focus-visible:ring-2 focus-visible:outline-none ${
                    team.colorId === preset.id
                      ? 'border-foreground scale-110 ring-2 ring-offset-2'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ background: teamColorVar(preset.id) }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={commit}>
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
