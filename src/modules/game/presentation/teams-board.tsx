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
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TeamsSnapshot, TeamMember } from '../domain/types';

interface TeamsBoardProps {
  snapshot: TeamsSnapshot;
  /** null — просмотр без правки (не организатор). */
  onChange: ((teamA: string[], teamB: string[]) => void) | null;
}

/**
 * Составы команд. Для организатора игроки перетаскиваются между командами
 * (drag-and-drop); для остальных — просто список.
 *
 * Родитель обязан передавать key={snapshot.generatedAt}: новый снапшот
 * (жеребьёвка/правка) пересоздаёт доску с серверным состоянием.
 */
export function TeamsBoard({ snapshot, onChange }: TeamsBoardProps) {
  const t = useTranslations('game.teams');
  const tPositions = useTranslations('positions');

  // Локальное состояние для мгновенного отклика на перетаскивание
  const [teams, setTeams] = useState<{ a: TeamMember[]; b: TeamMember[] }>({
    a: snapshot.teamA,
    b: snapshot.teamB,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    if (!onChange || !event.over) return;
    const playerId = String(event.active.id);
    const target = event.over.id === 'team-a' ? 'a' : 'b';

    const inA = teams.a.some((m) => m.participantId === playerId);
    const source = inA ? 'a' : 'b';
    if (source === target) return;

    const member =
      teams.a.find((m) => m.participantId === playerId) ??
      teams.b.find((m) => m.participantId === playerId);
    if (!member) return;

    const next = {
      a: teams.a.filter((m) => m.participantId !== playerId),
      b: teams.b.filter((m) => m.participantId !== playerId),
    };
    next[target] = [...next[target], member];
    setTeams(next);
    onChange(
      next.a.map((m) => m.participantId),
      next.b.map((m) => m.participantId),
    );
  };

  const columns = [
    { id: 'team-a', label: t('teamA'), members: teams.a },
    { id: 'team-b', label: t('teamB'), members: teams.b },
  ];

  const board = (
    <div className="grid gap-4 sm:grid-cols-2">
      {columns.map((column) => (
        <TeamColumn
          key={column.id}
          id={column.id}
          label={column.label}
          members={column.members}
          draggable={onChange !== null}
          positionLabel={(position) => tPositions(position)}
        />
      ))}
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
  draggable,
  positionLabel,
}: {
  id: string;
  label: string;
  members: TeamMember[];
  draggable: boolean;
  positionLabel: (position: TeamMember['position']) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}
    >
      <p className="mb-2 text-sm font-medium">{label}</p>
      <ul className="min-h-10 space-y-1">
        {members.map((member) => (
          <PlayerChip
            key={member.participantId}
            member={member}
            draggable={draggable}
            positionLabel={positionLabel(member.position)}
          />
        ))}
      </ul>
    </div>
  );
}

function PlayerChip({
  member,
  draggable,
  positionLabel,
}: {
  member: TeamMember;
  draggable: boolean;
  positionLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.participantId,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        isDragging ? 'z-10 opacity-70 shadow-lg' : ''
      } ${draggable ? 'cursor-grab touch-none' : ''}`}
      {...listeners}
      {...attributes}
    >
      {draggable ? (
        <GripVertical className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      ) : null}
      <span className="font-medium">{member.nickname}</span>
      <span className="text-muted-foreground text-xs">{positionLabel}</span>
    </li>
  );
}
