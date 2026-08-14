'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus,
  MapPin,
  Pencil,
  Share2,
  Shuffle,
  Timer,
  UserMinus,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ClubBadge } from '@/modules/profile/presentation/clubs';
import { FlagIcon } from '@/modules/profile/presentation/country-flag';
import { WeatherBadge } from '@/modules/weather/presentation/weather-badge';
import { useGameEvents } from '@/shared/hooks/use-game-events';
import { useHostToken } from '@/shared/hooks/use-host-token';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { formatGameDate, formatMoneyMinor, formatShortDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Pill } from '@/shared/ui/pill';
import { Progress } from '@/shared/ui/progress';
import { MATCHDAY_START_WINDOW_MINUTES } from '../domain/matchday';
import { REMOVAL_REASONS } from '../schemas';
import type { TeamMember, TeamsSnapshot } from '../domain/types';
import type { formTokenSchema } from '../schemas';
import type { GameViewData } from './api-types';
import { Countdown } from './countdown';
import type { ParticipantDto } from './dto';
import { EditGameDialog } from './edit-game-dialog';
import { JoinDialog } from './join-dialog';
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
  const tAttendance = useTranslations('attendance');
  const tCommon = useTranslations('common');

  const queryClient = useQueryClient();
  const hostToken = useHostToken(code);
  const [openedAt] = useState(() => Date.now());
  const [editOpen, setEditOpen] = useState(false);

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

  const tReasons = useTranslations('admin.reason');

  const data = query.data;
  const game = data.game;
  const isActive = game.status === 'OPEN' || game.status === 'FULL';
  // Организатор — по кабинету (сервер сверяет cookie с создателем игры);
  // hostToken больше не обязателен, но остаётся для старых игр
  const isHost = data.viewer.isHost;
  const you = [...data.participants, ...data.waitlist].find((p) => p.isYou) ?? null;
  const started = new Date(game.startsAt).getTime() <= openedAt;
  // Протокол матч-дня открывается за два часа до начала — то же окно,
  // что проверяет сервер (domain/matchday.ts)
  const matchDayOpen =
    game.status !== 'CANCELLED_BY_HOST' &&
    game.status !== 'CANCELLED_NOT_ENOUGH' &&
    game.status !== 'REMOVED_BY_ADMIN' &&
    new Date(game.startsAt).getTime() - MATCHDAY_START_WINDOW_MINUTES * 60_000 <= openedAt;

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

  const kickMutation = useMutation({
    mutationFn: (participantId: string) =>
      apiFetch<{ nickname: string; promotedNickname: string | null }>(
        `/api/games/${code}/participants/${participantId}`,
        { method: 'DELETE', headers: hostToken ? { 'x-host-token': hostToken } : {} },
      ),
    onSuccess: (result) => {
      toast.success(t('host.kicked', { nickname: result.nickname }));
      if (result.promotedNickname) {
        toast.info(t('promoted', { nickname: result.promotedNickname }));
      }
      void invalidate();
    },
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

  /**
   * Ссылка-приглашение: чистый адрес игры, без служебных параметров
   * страницы. Для приватной игры «по ссылке» ключ входит в адрес —
   * без него человек не запишется.
   */
  const inviteUrl = () => {
    const base = `${window.location.origin}/games/${game.code}`;
    return data.inviteKey !== null ? `${base}?key=${data.inviteKey}` : base;
  };

  /**
   * Делимся именно ссылкой. Раньше вместе с ней уходило описание игры,
   * и мессенджеры показывали текст вместо кликабельного адреса, а в
   * буфер попадала простыня из трёх строк — ссылку приходилось выковыривать.
   */
  const share = async () => {
    const url = inviteUrl();

    if (navigator.share) {
      const shared = await navigator
        .share({ title: game.title, url })
        .then(() => true)
        .catch(() => false);
      if (shared) return;
    }
    await navigator.clipboard.writeText(url);
    toast.success(tCommon('linkCopied'));
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

  const kick = (participant: ParticipantDto) => {
    const label = participant.tag !== null ? participant.name : participant.nickname;
    if (window.confirm(t('host.kickConfirm', { nickname: label }))) {
      kickMutation.mutate(participant.id);
    }
  };

  const mapUrl = `https://yandex.ru/maps/?pt=${game.longitude},${game.latitude}&z=16&l=map`;
  const rosterLabel = t('rosterProgress', { main: game.mainCount, max: game.maxPlayers });

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка: статус, название, место */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={isActive ? 'accent' : 'muted'}>{tStatuses(game.status)}</Pill>
          {game.visibility !== 'PUBLIC' ? <Pill tone="muted">{t('private')}</Pill> : null}
          <Pill>{tFormats(game.format)}</Pill>
          {game.skillLevel !== 'ANY' ? <Pill>{tLevels(game.skillLevel)}</Pill> : null}
          {isActive && !started ? <WeatherBadge gameCode={code} /> : null}
          <span className="text-muted-foreground ml-auto digits text-xs tracking-wider">
            {game.code}
          </span>
        </div>

        <h1 className="display text-3xl leading-[1.05] text-balance sm:text-4xl">{game.title}</h1>

        {/* Снятую модерацией игру объясняем прямо на её странице */}
        {game.status === 'REMOVED_BY_ADMIN' ? (
          <p className="text-destructive text-sm">
            {t('removedBanner', {
              reason: tReasons(
                REMOVAL_REASONS.some((code) => code === game.removalReason)
                  ? (game.removalReason as string)
                  : 'OTHER',
              ),
            })}
            {game.removalNote !== null && game.removalNote !== '' ? ` — ${game.removalNote}` : ''}
          </p>
        ) : null}

        {isActive && !started ? <Countdown startsAtIso={game.startsAt} /> : null}

        <p className="text-muted-foreground text-sm">
          {formatGameDate(game.startsAt, game.timezone)} ·{' '}
          {game.durationMinutes === null
            ? t('durationOpen')
            : t('duration', { count: game.durationMinutes })}
          {game.teamCount > 2 ? <> · {t('teamCountLine', { count: game.teamCount })}</> : null}
          <br />
          {game.venueName} · {game.city}
        </p>
      </section>

      {/* Матч-день: протокол открыт всем, вести его может менеджер */}
      {matchDayOpen ? (
        <Button asChild size="lg" className="display text-base tracking-wide">
          <Link href={`/games/${code}/day`}>
            <Timer className="size-4" aria-hidden /> {t('matchDay')}
          </Link>
        </Button>
      ) : null}

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
                  levelLabel={
                    participant.skillLevel === 'ANY' ? null : tLevels(participant.skillLevel)
                  }
                  maybeLabel={participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null}
                  onKick={isHost && isActive && !participant.isYou ? () => kick(participant) : null}
                  kickLabel={t('host.kick')}
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
                    levelLabel={
                      participant.skillLevel === 'ANY' ? null : tLevels(participant.skillLevel)
                    }
                    maybeLabel={participant.attendance === 'MAYBE' ? tAttendance('MAYBE') : null}
                    onKick={
                      isHost && isActive && !participant.isYou ? () => kick(participant) : null
                    }
                    kickLabel={t('host.kick')}
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
              visibility={game.visibility}
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
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> {t('host.edit')}
              </Button>
              {/* Жеребьёвка нужна только там, где есть команды: у сбора её нет */}
              {game.teamCount > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => shuffleMutation.mutate()}
                  disabled={shuffleMutation.isPending}
                >
                  <Shuffle className="size-4" />
                  {game.teamsSnapshot ? t('host.reshuffle') : t('host.shuffle')}
                </Button>
              ) : null}
              <Button variant="outline" onClick={cancelGame} disabled={cancelMutation.isPending}>
                <XCircle className="size-4" /> {t('host.cancelGame')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {editOpen ? (
        <EditGameDialog
          game={game}
          hostToken={hostToken}
          onClose={() => setEditOpen(false)}
          onSaved={() => void invalidate()}
        />
      ) : null}
    </div>
  );
}

/** Строка состава: номер как на футболке, тег, уровень игрока. */
function PlayerRow({
  participant,
  number,
  levelLabel,
  maybeLabel,
  onKick,
  kickLabel,
}: {
  participant: ParticipantDto;
  number: number;
  /** Уровень игрока из кабинета; null — не указан, строку не занимаем. */
  levelLabel: string | null;
  maybeLabel: string | null;
  /** Организатору — убрать игрока из состава; null — кнопки нет. */
  onKick: (() => void) | null;
  kickLabel: string;
}) {
  const secondLine = [levelLabel, maybeLabel?.toLowerCase()].filter(Boolean).join(' · ');

  return (
    <li
      className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2 last:border-b-0 ${
        // Своя строка подсвечена во всю ширину карточки: заливка,
        // обрывающаяся до краёв, читается как случайный отступ
        participant.isYou ? 'bg-primary/5 -mx-(--card-spacing) px-(--card-spacing)' : ''
      }`}
    >
      <span className="text-muted-foreground digits text-sm">
        {String(number).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">
          {/* С кабинетом показываем имя из профиля: ник там равен тегу,
              и строка превращалась в «sun @sun». Гость же назвал ник
              именно для показа — у него настоящее имя не светим */}
          {participant.tag !== null ? participant.name : participant.nickname}
          {participant.country !== null ? (
            <FlagIcon code={participant.country} width={16} className="ml-1.5" />
          ) : null}
          {participant.club !== null ? (
            <ClubBadge clubId={participant.club} size={16} className="ml-1.5" />
          ) : null}
          {participant.tag !== null ? (
            <span className="text-lamp ml-1.5 text-xs font-medium">@{participant.tag}</span>
          ) : null}
        </span>
        {secondLine !== '' ? (
          <span className="text-muted-foreground truncate text-xs">{secondLine}</span>
        ) : null}
      </span>
      {onKick !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={kickLabel}
          title={kickLabel}
          onClick={onKick}
        >
          <UserMinus className="size-4" aria-hidden />
        </Button>
      ) : (
        <span aria-hidden />
      )}
    </li>
  );
}
