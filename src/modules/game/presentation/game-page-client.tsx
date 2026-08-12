'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, MapPin, Share2, Shuffle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useHostToken } from '@/shared/hooks/use-host-token';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { formatGameDate, formatMoneyMinor, formatShortDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { Separator } from '@/shared/ui/separator';
import type { TeamsSnapshot } from '../domain/types';
import type { formTokenSchema } from '../schemas';
import type { GameViewData } from './api-types';
import { Countdown } from './countdown';
import type { ParticipantDto } from './dto';
import { JoinDialog } from './join-dialog';

interface GamePageClientProps {
  code: string;
  initialData: GameViewData;
  formToken: z.infer<typeof formTokenSchema>;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default',
  FULL: 'secondary',
  CANCELLED_BY_HOST: 'destructive',
  CANCELLED_NOT_ENOUGH: 'destructive',
  FINISHED: 'outline',
};

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
  // Момент открытия страницы: достаточно для проверок «игра началась» /
  // «дедлайн прошёл» (живое обновление даёт Countdown и рефетчи)
  const [openedAt] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ['game', code, Boolean(hostToken)],
    queryFn: () =>
      apiFetch<GameViewData>(`/api/games/${code}`, {
        headers: hostToken ? { 'x-host-token': hostToken } : {},
      }),
    initialData,
    // SSR-данные сразу считаются устаревшими: первый рендер мгновенный,
    // но клиент тут же дотягивает свежее состояние (в т.ч. isHost по токену)
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
    const message = pastDeadline ? t('leaveLate') : t('leaveConfirm');
    if (window.confirm(message)) leaveMutation.mutate();
  };

  const cancelGame = () => {
    if (window.confirm(t('host.cancelConfirm'))) cancelMutation.mutate();
  };

  const mapUrl = `https://yandex.ru/maps/?pt=${game.longitude},${game.latitude}&z=16&l=map`;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANTS[game.status] ?? 'outline'}>
            {tStatuses(game.status)}
          </Badge>
          <Badge variant="outline">{tFormats(game.format)}</Badge>
          <Badge variant="outline">{tLevels(game.skillLevel)}</Badge>
          <span className="text-muted-foreground ml-auto font-mono text-xs">{game.code}</span>
        </div>
        <h1 className="text-2xl font-bold">{game.title}</h1>
        <p className="text-muted-foreground text-sm">
          {formatGameDate(game.startsAt, game.timezone)} ·{' '}
          {t('duration', { count: game.durationMinutes })}
        </p>
        {isActive && !started ? <Countdown startsAtIso={game.startsAt} /> : null}
      </div>

      {/* Прогресс состава */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-baseline justify-between text-base">
            <span>{t('roster')}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {t('rosterProgress', { main: game.mainCount, max: game.maxPlayers })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={(game.mainCount / game.maxPlayers) * 100}
            aria-label={t('rosterProgress', { main: game.mainCount, max: game.maxPlayers })}
          />
          {isActive ? (
            game.needMore > 0 ? (
              <p className="text-amber-600 dark:text-amber-400 text-sm" aria-live="polite">
                {t('needMoreBanner', { min: game.minPlayers, count: game.needMore })}
              </p>
            ) : (
              <p className="text-emerald-600 dark:text-emerald-400 text-sm" aria-live="polite">
                {t('viable')}
              </p>
            )
          ) : null}

          <ul className="space-y-1.5" aria-live="polite">
            {data.participants.length === 0 ? (
              <li className="text-muted-foreground text-sm">{t('empty')}</li>
            ) : (
              data.participants.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  positionLabel={tPositions(participant.position)}
                  attendanceLabel={participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null}
                />
              ))
            )}
          </ul>

          {data.waitlist.length > 0 ? (
            <>
              <Separator />
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('waitlistTitle')}</p>
                <p className="text-muted-foreground mb-2 text-xs">{t('waitlistHint')}</p>
                <ul className="space-y-1.5">
                  {data.waitlist.map((participant) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      positionLabel={tPositions(participant.position)}
                      attendanceLabel={
                        participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null
                      }
                    />
                  ))}
                </ul>
              </div>
            </>
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
              className="flex-1"
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
          <Button size="lg" variant="outline" asChild>
            <a href={`/api/games/${code}/ics`} download>
              <CalendarPlus className="size-4" /> {t('addToCalendar')}
            </a>
          </Button>
        </div>
      ) : null}
      {you ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {you.role === 'WAITLIST'
            ? t('youAreWaitlisted', { order: you.waitlistOrder ?? 0 })
            : t('youAreIn')}
        </p>
      ) : null}

      {/* Команды после жеребьёвки */}
      {game.teamsSnapshot ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('teams.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: t('teams.teamA'), members: game.teamsSnapshot.teamA },
                { label: t('teams.teamB'), members: game.teamsSnapshot.teamB },
              ].map(({ label, members }) => (
                <div key={label}>
                  <p className="mb-1.5 text-sm font-medium">{label}</p>
                  <ul className="space-y-1">
                    {members.map((member) => (
                      <li key={member.participantId} className="text-sm">
                        {member.nickname}{' '}
                        <span className="text-muted-foreground text-xs">
                          {tPositions(member.position)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">{t('teams.generatedHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Стоимость */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('priceTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {game.pricePerPitch === 0 ? (
            <p>{t('priceFree')}</p>
          ) : (
            <>
              <p>
                {t('pricePerPitch', { price: formatMoneyMinor(game.pricePerPitch, game.currency) })}
              </p>
              {game.perPersonPrice !== null ? (
                <p className="font-medium" aria-live="polite">
                  {t('perPersonNow', {
                    price: formatMoneyMinor(game.perPersonPrice, game.currency),
                  })}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Детали */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('detailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{game.venueName}</p>
          <p className="text-muted-foreground">
            {game.city}, {game.address}
          </p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <MapPin className="size-4" aria-hidden /> {tCommon('openMap')}
          </a>
          {game.description ? <p className="whitespace-pre-line pt-2">{game.description}</p> : null}
          <p className="text-muted-foreground pt-2 text-xs">
            {t('cancelDeadline', { date: formatShortDate(game.cancelDeadline, game.timezone) })}
          </p>
        </CardContent>
      </Card>

      {/* Панель организатора */}
      {isHost && isActive ? (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('host.panel')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => shuffleMutation.mutate()}
              disabled={shuffleMutation.isPending}
            >
              <Shuffle className="size-4" />
              {game.teamsSnapshot ? t('host.reshuffle') : t('host.shuffle')}
            </Button>
            <Button variant="destructive" onClick={cancelGame} disabled={cancelMutation.isPending}>
              <XCircle className="size-4" /> {t('host.cancelGame')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ParticipantRow({
  participant,
  positionLabel,
  attendanceLabel,
}: {
  participant: ParticipantDto;
  positionLabel: string;
  attendanceLabel: string | null;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        participant.isYou ? 'bg-primary/10' : ''
      }`}
    >
      <span className="font-medium">{participant.nickname}</span>
      <span className="text-muted-foreground text-xs">{positionLabel}</span>
      {attendanceLabel ? (
        <Badge variant="outline" className="ml-auto text-xs">
          {attendanceLabel}
        </Badge>
      ) : null}
      {participant.waitlistOrder !== null ? (
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          №{participant.waitlistOrder}
        </span>
      ) : null}
    </li>
  );
}
