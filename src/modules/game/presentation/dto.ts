import { reliabilityBadge, type ReliabilityBadge } from '@/modules/reliability/domain/score';
import { splitPrice } from '../domain/price-split';
import type { GameEntity, ParticipantEntity, TeamsSnapshot } from '../domain/types';
import type { ParticipantReliability } from '../application/ports';

/**
 * DTO наружу. Хеши токенов и прочие серверные поля сюда не попадают.
 */
export interface ParticipantDto {
  id: string;
  name: string;
  nickname: string;
  position: string;
  skillLevel: string;
  attendance: string;
  role: string;
  waitlistOrder: number | null;
  joinedAt: string;
  isYou: boolean;
  reliability: ReliabilityBadge;
  /** Тег кабинета («vanya» без @); null — гость. */
  tag: string | null;
  /** Код страны из профиля — флаг рядом с ником. */
  country: string | null;
  /** Любимый клуб из профиля — значок рядом с ником. */
  club: string | null;
}

export interface GameDto {
  code: string;
  title: string;
  description: string | null;
  status: string;
  format: string;
  skillLevel: string;
  startsAt: string;
  /** null — «как получится»: длительность не фиксирована. */
  durationMinutes: number | null;
  /** Сколько команд играет (2–4). */
  teamCount: number;
  timezone: string;
  minPlayers: number;
  maxPlayers: number;
  pricePerPitch: number;
  currency: string;
  cancelDeadline: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  hostName: string;
  teamsSnapshot: TeamsSnapshot | null;
  createdAt: string;
}

export interface GameSummaryDto extends GameDto {
  mainCount: number;
  freeSlots: number;
  /** Сколько ещё не хватает до минимума (прогресс жизнеспособности). */
  needMore: number;
  perPersonPrice: number | null;
}

export function gameToDto(game: GameEntity): GameDto {
  return {
    code: game.code,
    title: game.title,
    description: game.description,
    status: game.status,
    format: game.format,
    skillLevel: game.skillLevel,
    startsAt: game.startsAt.toISOString(),
    durationMinutes: game.durationMinutes,
    teamCount: game.teamCount,
    timezone: game.timezone,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    pricePerPitch: game.pricePerPitch,
    currency: game.currency,
    cancelDeadline: game.cancelDeadline.toISOString(),
    venueName: game.venueName,
    address: game.address,
    latitude: game.latitude,
    longitude: game.longitude,
    city: game.city,
    hostName: game.hostName,
    teamsSnapshot: game.teamsSnapshot,
    createdAt: game.createdAt.toISOString(),
  };
}

export function gameToSummaryDto(
  game: GameEntity,
  activeMainCount: number,
  confirmedMainCount: number,
): GameSummaryDto {
  return {
    ...gameToDto(game),
    mainCount: activeMainCount,
    freeSlots: Math.max(0, game.maxPlayers - activeMainCount),
    needMore: Math.max(0, game.minPlayers - activeMainCount),
    perPersonPrice: splitPrice(game.pricePerPitch, confirmedMainCount).perPersonMinor,
  };
}

export function participantToDto(
  participant: ParticipantEntity,
  viewerTokenHash: string | null,
  profile?: ParticipantReliability,
): ParticipantDto {
  return {
    id: participant.id,
    name: participant.name,
    nickname: participant.nickname,
    position: participant.position,
    skillLevel: participant.skillLevel,
    attendance: participant.attendance,
    role: participant.role,
    waitlistOrder: participant.waitlistOrder,
    joinedAt: participant.joinedAt.toISOString(),
    isYou: viewerTokenHash !== null && participant.tokenHash === viewerTokenHash,
    reliability: reliabilityBadge(profile ?? { gamesJoined: 0, gamesAttended: 0, lateCancels: 0 }),
    tag: participant.profileTag,
    country: participant.profileCountry,
    club: participant.profileClub,
  };
}
