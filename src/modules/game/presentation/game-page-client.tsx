'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, MapPin, Share2, Shuffle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { WeatherBadge } from '@/modules/weather/presentation/weather-badge';
import { useGameEvents } from '@/shared/hooks/use-game-events';
import { useHostToken } from '@/shared/hooks/use-host-token';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { formatGameDate, formatMoneyMinor, formatShortDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Pill } from '@/shared/ui/pill';
import { Progress } from '@/shared/ui/progress';
import type { TeamMember, TeamsSnapshot } from '../domain/types';
import type { formTokenSchema } from '../schemas';
import type { GameViewData } from './api-types';
import { Countdown } from './countdown';
import type { ParticipantDto } from './dto';
import { JoinDialog } from './join-dialog';
import { QrDialog } from './qr-dialog';
import { TeamsBoard } from './teams-board';

interface GamePageClientProps {
  code: string;
  initialData: GameViewData;
  formToken: z.infer<typeof formTokenSchema>;
}

export function GamePageClient({ code, initialData, formToken }: GamePageClientProps) {
  const t = useTranslations('game');
  const tStatuses = useTranslations('statuses');
  const tFormats = useTranslations('formats');
  const tLevels = useTranslations('levels');
  const tPositions = useTranslations('positions');
  const tAttendance = useTranslations('attendance');
  const tCommon = useTranslations('common');

  const queryClient = useQueryClient();
  const hostToken = useHostToken(code);
  const [openedAt] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ['game', code, Boolean(hostToken)],
    queryFn: () =>
      apiFetch<GameViewData>(`/api/games/${code}`, {
        headers: hostToken ? { 'x-host-token': hostToken } : {},
      }),
    initialData,
    initialDataUpdatedAt: 0,
    refetchOnWindowFocus: true,
  });

  const data = query.data;
  const game = data.game;
  const isActive = game.status === 'OPEN' || game.status === 'FULL';
  const isHost = data.viewer.isHost && hostToken !== null;
  const you = [...data.participants, ...data.waitlist].find((p) => p.isYou) ?? null;
  const started = new Date(game.startsAt).getTime() <= openedAt;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['game', code] });

  useGameEvents(code, () => void invalidate());

  const onApiError = (error: unknown) => {
    toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
  };

  const leaveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ wasLateCancel: boolean; promotedNickname: string | null }>(
        `/api/games/${code}/participants/me`,
        { method: 'DELETE' },
      ),
    onSuccess: (result) => {
      if (result.promotedNickname) {
        toast.info(t('promoted', { nickname: result.promotedNickname }));
      }
      void invalidate();
    },
    onError: onApiError,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/games/${code}`, {
        method: 'DELETE',
        headers: hostToken ? { 'x-host-token': hostToken } : {},
      }),
    onSuccess: () => {
      toast.success(t('host.cancelled'));
      void invalidate();
    },
    onError: onApiError,
  });

  const shuffleMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ teams: TeamsSnapshot }>(`/api/games/${code}/teams/shuffle`, {
        method: 'POST',
        headers: hostToken ? { 'x-host-token': hostToken } : {},
      }),
    onSuccess: () => void invalidate(),
    onError: onApiError,
  });

  const setTeamsMutation = useMutation({
    mutationFn: (teams: { teamA: string[]; teamB: string[] }) =>
      apiFetch<{ teams: TeamsSnapshot }>(`/api/games/${code}/teams`, {
        method: 'PUT',
        headers: hostToken ? { 'x-host-token': hostToken } : {},
        body: JSON.stringify(teams),
      }),
    onSuccess: () => void invalidate(),
    onError: (error) => {
      onApiError(error);
      void invalidate();
    },
  });

  const share = async () => {
    const url = window.location.href;
    const text = `${game.title} — ${formatGameDate(game.startsAt, game.timezone)}`;
    if (navigator.share) {
      await navigator.share({ title: game.title, text, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(tCommon('linkCopied'));
    }
  };

  const leave = () => {
    const pastDeadline = new Date(game.cancelDeadline).getTime() <= Date.now();
    if (window.confirm(pastDeadline ? t('leaveLate') : t('leaveConfirm'))) {
      leaveMutation.mutate();
    }
  };

  const cancelGame = () => {
    if (window.confirm(t('host.cancelConfirm'))) cancelMutation.mutate();
  };

  const mapUrl = `https://yandex.ru/maps/?pt=${game.longitude},${game.latitude}&z=16&l=map`;
  const rosterLabel = t('rosterProgress', { main: game.mainCount, max: game.maxPlayers });

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка: статус, название, место */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={isActive ? 'accent' : 'muted'}>{tStatuses(game.status)}</Pill>
          <Pill>{tFormats(game.format)}</Pill>
          <Pill>{tLevels(game.skillLevel)}</Pill>
          {isActive && !started ? <WeatherBadge gameCode={code} /> : null}
          <span className="text-muted-foreground ml-auto digits text-xs tracking-wider">
            {game.code}
          </span>
        </div>

        <h1 className="display text-3xl leading-[1.05] text-balance sm:text-4xl">{game.title}</h1>

        {isActive && !started ? <Countdown startsAtIso={game.startsAt} /> : null}

        <p className="text-muted-foreground text-sm">
          {formatGameDate(game.startsAt, game.timezone)} ·{' '}
          {t('duration', { count: game.durationMinutes })}
          <br />
          {game.venueName} · {game.city}
        </p>
      </section>

      {/* Состав */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eyebrow text-muted-foreground">{t('roster')}</span>
            <span className="digits text-sm">
              <b className="text-lg font-bold">{game.mainCount}</b>
              <span className="text-muted-foreground"> / {game.maxPlayers}</span>
            </span>
          </div>

          <Progress value={(game.mainCount / game.maxPlayers) * 100} aria-label={rosterLabel} />

          {isActive ? (
            game.needMore > 0 ? (
              <p className="text-lamp text-sm" aria-live="polite">
                {t('needMoreBanner', { min: game.minPlayers, count: game.needMore })}
              </p>
            ) : (
              <p className="text-success text-sm" aria-live="polite">
                {t('viable')}
              </p>
            )
          ) : null}

          <ul className="flex flex-col" aria-live="polite">
            {data.participants.length === 0 ? (
              <li className="text-muted-foreground py-2 text-sm">{t('empty')}</li>
            ) : (
              data.participants.map((participant, index) => (
                <PlayerRow
                  key={participant.id}
                  participant={participant}
                  number={index + 1}
                  positionLabel={tPositions(participant.position)}
                  maybeLabel={participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null}
                />
              ))
            )}
          </ul>

          {data.waitlist.length > 0 ? (
            <div className="border-t pt-3">
              <p className="eyebrow text-muted-foreground">{t('waitlistTitle')}</p>
              <p className="text-muted-foreground mt-1 mb-2 text-xs">{t('waitlistHint')}</p>
              <ul className="flex flex-col">
                {data.waitlist.map((participant) => (
                  <PlayerRow
                    key={participant.id}
                    participant={participant}
                    number={participant.waitlistOrder ?? 0}
                    positionLabel={tPositions(participant.position)}
                    maybeLabel={participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Действия */}
      {isActive && !started ? (
        <div className="flex flex-wrap gap-2">
          {you ? (
            <Button
              size="lg"
              variant="outline"
              className="display flex-1 tracking-wide"
              onClick={leave}
              disabled={leaveMutation.isPending}
            >
              <XCircle className="size-4" /> {t('leave')}
            </Button>
          ) : (
            <JoinDialog
              gameCode={code}
              isFull={game.status === 'FULL'}
              formToken={formToken}
              onJoined={() => void invalidate()}
            />
          )}
          <Button size="lg" variant="outline" onClick={() => void share()}>
            <Share2 className="size-4" /> {t('share')}
          </Button>
          <QrDialog gameCode={code} title={game.title} />
          <Button size="lg" variant="outline" asChild>
            <a href={`/api/games/${code}/ics`} download>
              <CalendarPlus className="size-4" /> {t('addToCalendar')}
            </a>
          </Button>
        </div>
      ) : null}

      {you ? (
        <p className="eyebrow text-lamp" aria-live="polite">
          {you.role === 'WAITLIST'
            ? t('youAreWaitlisted', { order: you.waitlistOrder ?? 0 })
            : t('youAreIn')}
        </p>
      ) : null}

      {/* Составы команд */}
      {game.teamsSnapshot ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-0">
            <span className="eyebrow text-muted-foreground">{t('teams.title')}</span>
            <TeamsBoard
              key={`${game.teamsSnapshot.generatedAt}:${data.participants.length}`}
              snapshot={game.teamsSnapshot}
              unassigned={data.participants
                .filter(
                  (p) =>
                    !game.teamsSnapshot!.teamA.some((m) => m.participantId === p.id) &&
                    !game.teamsSnapshot!.teamB.some((m) => m.participantId === p.id),
                )
                .map((p) => ({
                  participantId: p.id,
                  nickname: p.nickname,
                  position: p.position as TeamMember['position'],
                  skillLevel: p.skillLevel as TeamMember['skillLevel'],
                }))}
              onChange={
                isHost && isActive
                  ? (teamA, teamB) => setTeamsMutation.mutate({ teamA, teamB })
                  : null
              }
            />
            <p className="text-muted-foreground text-xs">{t('teams.generatedHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Стоимость */}
      <Card>
        <CardContent className="flex flex-wrap items-baseline justify-between gap-2 pt-0">
          {game.pricePerPitch === 0 ? (
            <span className="text-sm">{t('priceFree')}</span>
          ) : (
            <>
              <div className="flex flex-col">
                <span className="eyebrow text-muted-foreground">{t('perPersonLabel')}</span>
                <span className="text-muted-foreground text-xs">
                  {t('pricePerPitch', {
                    price: formatMoneyMinor(game.pricePerPitch, game.currency),
                  })}
                </span>
              </div>
              <span className="display text-lamp text-2xl" aria-live="polite">
                {game.perPersonPrice !== null
                  ? formatMoneyMinor(game.perPersonPrice, game.currency)
                  : '—'}
              </span>
            </>
          )}
        </CardContent>
      </Card>

      {/* Детали */}
      <Card>
        <CardContent className="flex flex-col gap-2 pt-0 text-sm">
          <span className="eyebrow text-muted-foreground">{t('detailsTitle')}</span>
          <p className="font-medium">{game.venueName}</p>
          <p className="text-muted-foreground">
            {game.city}, {game.address}
          </p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-lamp inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <MapPin className="size-4" aria-hidden /> {tCommon('openMap')}
          </a>
          {game.description ? <p className="pt-1 whitespace-pre-line">{game.description}</p> : null}
          <p className="text-muted-foreground pt-1 text-xs">
            {t('cancelDeadline', { date: formatShortDate(game.cancelDeadline, game.timezone) })}
          </p>
        </CardContent>
      </Card>

      {/* Управление игрой */}
      {isHost && isActive ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-3 pt-0">
            <span className="eyebrow text-lamp">{t('host.panel')}</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => shuffleMutation.mutate()}
                disabled={shuffleMutation.isPending}
              >
                <Shuffle className="size-4" />
                {game.teamsSnapshot ? t('host.reshuffle') : t('host.shuffle')}
              </Button>
              <Button variant="outline" onClick={cancelGame} disabled={cancelMutation.isPending}>
                <XCircle className="size-4" /> {t('host.cancelGame')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Строка состава: номер как на футболке, позиция, индекс надёжности. */
function PlayerRow({
  participant,
  number,
  positionLabel,
  maybeLabel,
}: {
  participant: ParticipantDto;
  number: number;
  positionLabel: string;
  maybeLabel: string | null;
}) {
  const t = useTranslations('reliability');
  const isNew = participant.reliability.kind === 'new';
  const percent = participant.reliability.kind === 'score' ? participant.reliability.percent : 0;

  return (
    <li
      className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2 last:border-b-0 ${
        participant.isYou ? 'bg-primary/5' : ''
      }`}
    >
      <span className="text-muted-foreground digits text-sm">
        {String(number).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">
          {participant.nickname}
          {participant.tag !== null ? (
            <span className="text-lamp ml-1.5 text-xs font-medium">@{participant.tag}</span>
          ) : null}
        </span>
        {/* Позиция и «под вопросом» — одной строкой: отдельная пилюля
            съедала место у никнейма и обрезала его до одной буквы */}
        <span className="text-muted-foreground truncate text-xs">
          {maybeLabel ? `${positionLabel} · ${maybeLabel.toLowerCase()}` : positionLabel}
        </span>
      </span>
      <span
        className={`shrink-0 digits text-[0.68rem] tracking-wider ${
          isNew ? 'text-muted-foreground' : 'text-foreground'
        }`}
        title={isNew ? t('newTitle') : t('scoreTitle', { percent })}
      >
        {isNew ? t('newChip') : t('scoreChip', { percent })}
      </span>
    </li>
  );
}
