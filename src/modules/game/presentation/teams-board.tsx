'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TeamsSnapshot, TeamMember } from '../domain/types';

interface TeamsBoardProps {
  snapshot: TeamsSnapshot;
  /** Основные игроки, которых ещё нет в составах (вступили после жеребьёвки). */
  unassigned: TeamMember[];
  /** null — просмотр без правки (не организатор). */
  onChange: ((teamA: string[], teamB: string[]) => void) | null;
}

/**
 * Составы команд. Организатор переводит игрока НАЖАТИЕМ (на телефоне
 * перетаскивание неудобно), перетаскивание тоже работает. Игроки,
 * вступившие после жеребьёвки, видны в блоке «вне составов» и
 * добавляются нажатием в меньшую команду.
 *
 * Родитель обязан передавать key={snapshot.generatedAt}: новый снапшот
 * пересоздаёт доску с серверным состоянием.
 */
export function TeamsBoard({ snapshot, unassigned, onChange }: TeamsBoardProps) {
  const t = useTranslations('game.teams');
  const tPositions = useTranslations('positions');

  const [teams, setTeams] = useState<{ a: TeamMember[]; b: TeamMember[] }>({
    a: snapshot.teamA,
    b: snapshot.teamB,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const commit = (next: { a: TeamMember[]; b: TeamMember[] }) => {
    setTeams(next);
    onChange?.(
      next.a.map((m) => m.participantId),
      next.b.map((m) => m.participantId),
    );
  };

  const moveTo = (playerId: string, target: 'a' | 'b') => {
    const member =
      teams.a.find((m) => m.participantId === playerId) ??
      teams.b.find((m) => m.participantId === playerId) ??
      unassigned.find((m) => m.participantId === playerId);
    if (!member) return;

    const next = {
      a: teams.a.filter((m) => m.participantId !== playerId),
      b: teams.b.filter((m) => m.participantId !== playerId),
    };
    next[target] = [...next[target], member];
    commit(next);
  };

  /** Нажатие: из команды — в противоположную, со скамейки — в меньшую. */
  const onTap = (playerId: string) => {
    if (!onChange) return;
    if (teams.a.some((m) => m.participantId === playerId)) moveTo(playerId, 'b');
    else if (teams.b.some((m) => m.participantId === playerId)) moveTo(playerId, 'a');
    else moveTo(playerId, teams.a.length <= teams.b.length ? 'a' : 'b');
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!onChange || !event.over) return;
    moveTo(String(event.active.id), event.over.id === 'team-a' ? 'a' : 'b');
  };

  const board = (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { id: 'team-a', label: t('teamA'), members: teams.a },
            { id: 'team-b', label: t('teamB'), members: teams.b },
          ] as const
        ).map((column) => (
          <TeamColumn
            key={column.id}
            id={column.id}
            label={column.label}
            members={column.members}
            editable={onChange !== null}
            onTap={onTap}
            positionLabel={(position) => tPositions(position)}
          />
        ))}
      </div>

      {unassigned.length > 0 ? (
        <div className="border-t pt-3">
          <p className="eyebrow text-muted-foreground mb-2">{t('unassigned')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {unassigned.map((member) => (
              <li key={member.participantId}>
                <button
                  type="button"
                  disabled={!onChange}
                  onClick={() => onTap(member.participantId)}
                  className="border-border text-muted-foreground hover:border-primary/60 focus-visible:ring-ring flex items-center gap-1.5 rounded-sm border border-dashed px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                >
                  {onChange ? <UserPlus className="size-3.5" aria-hidden /> : null}
                  <span className="font-semibold">{member.nickname}</span>
                  <span className="text-xs">{tPositions(member.position)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onChange ? <p className="text-muted-foreground text-xs">{t('tapHint')}</p> : null}
    </div>
  );

  if (!onChange) return board;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {board}
    </DndContext>
  );
}

function TeamColumn({
  id,
  label,
  members,
  editable,
  onTap,
  positionLabel,
}: {
  id: string;
  label: string;
  members: TeamMember[];
  editable: boolean;
  onTap: (playerId: string) => void;
  positionLabel: (position: TeamMember['position']) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !editable });

  return (
    <div
      ref={setNodeRef}
      className={`bg-background/40 rounded-md border transition-colors ${
        isOver ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <p className="eyebrow text-muted-foreground border-b px-3 py-2">
        {label} <span className="text-foreground">· {members.length}</span>
      </p>
      <ul className="flex min-h-12 flex-col p-1.5">
        {members.map((member) => (
          <PlayerChip
            key={member.participantId}
            member={member}
            editable={editable}
            onTap={onTap}
            positionLabel={positionLabel(member.position)}
          />
        ))}
      </ul>
    </div>
  );
}

function PlayerChip({
  member,
  editable,
  onTap,
  positionLabel,
}: {
  member: TeamMember;
  editable: boolean;
  onTap: (playerId: string) => void;
  positionLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.participantId,
    disabled: !editable,
  });

  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={isDragging ? 'z-10 opacity-70' : ''}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        disabled={!editable}
        onClick={() => onTap(member.participantId)}
        className="hover:bg-secondary/60 focus-visible:ring-ring grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
      >
        {editable ? (
          <GripVertical className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        ) : (
          <span className="bg-muted-foreground/50 size-1.5 rounded-full" aria-hidden />
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{member.nickname}</span>
          <span className="text-muted-foreground text-xs">{positionLabel}</span>
        </span>
      </button>
    </li>
  );
}
