import type { Game, Participant } from '@/generated/prisma/client';
import type { GameEntity, ParticipantEntity, TeamsSnapshot } from '../domain/types';

export function toGameEntity(row: Game): GameEntity {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    format: row.format,
    skillLevel: row.skillLevel,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    pricePerPitch: row.pricePerPitch,
    currency: row.currency,
    cancelDeadline: row.cancelDeadline,
    venueName: row.venueName,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
    hostName: row.hostName,
    hostTokenHash: row.hostTokenHash,
    teamsSnapshot: (row.teamsSnapshot as unknown as TeamsSnapshot | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toParticipantEntity(row: Participant): ParticipantEntity {
  return {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    nickname: row.nickname,
    position: row.position,
    skillLevel: row.skillLevel,
    attendance: row.attendance,
    role: row.role,
    waitlistOrder: row.waitlistOrder,
    tokenHash: row.tokenHash,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    wasLateCancel: row.wasLateCancel,
  };
}
