'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm, type UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { isClean } from '@/modules/moderation/domain/profanity';
import type { ProfileDto } from '@/modules/profile/schemas';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { toDatetimeLocalValue } from '@/shared/lib/format';
import { saveHostToken } from '@/shared/lib/host-tokens';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { MAX_START_DAYS_AHEAD, defaultCancelDeadline } from '../domain/game-rules';
import { GAME_FORMATS, GAME_VISIBILITIES, SKILL_LEVELS, type formTokenSchema } from '../schemas';
import type { GameDto } from './dto';

interface CreateGameFormProps {
  formToken: z.infer<typeof formTokenSchema>;
  defaults: { city: string; currency: string; timezone: string };
}

type CreatedGame = { game: GameDto; hostToken: string; inviteKey: string | null };

const createFormSchema = z
  .object({
    // Тот же фильтр, что на сервере: ошибку видно сразу под полем
    title: z
      .string()
      .trim()
      .min(3, 'минимум 3 симв.')
      .max(80)
      .refine(isClean, 'уберите грубое или оскорбительное слово'),
    description: z
      .string()
      .max(2000)
      .refine(isClean, 'уберите грубое или оскорбительное слово')
      .optional(),
    format: z.enum(GAME_FORMATS),
    skillLevel: z.enum(SKILL_LEVELS),
    startsAtLocal: z.string().min(1, 'укажите дату'),
    // При «как получится» поле неактивно, но число в состоянии остаётся —
    // валидация не спотыкается, а на сервер уходит null
    flexDuration: z.boolean(),
    durationMinutes: z.number({ message: 'число' }).int().min(30).max(480),
    teamCount: z.number().int().min(1).max(4),
    visibility: z.enum(GAME_VISIBILITIES),
    joinPassword: z.string().optional(),
    venueName: z.string().trim().min(2, 'минимум 2 симв.').max(80),
    address: z.string().trim().min(3, 'минимум 3 симв.').max(160),
    city: z.string().trim().min(2, 'минимум 2 симв.').max(60),
    minPlayers: z.number({ message: 'число' }).int().min(2).max(30),
    maxPlayers: z.number({ message: 'число' }).int().min(4).max(30),
    priceRub: z.number({ message: 'число' }).min(0).max(1_000_000),
    joinAsPlayer: z.boolean(),
    cancelDeadlineLocal: z.string().optional(),
    website: z.string().optional(),
  })
  .refine((d) => d.maxPlayers >= d.minPlayers, {
    path: ['maxPlayers'],
    message: 'не меньше минимума',
  })
  .refine((d) => d.visibility !== 'PRIVATE_PASSWORD' || (d.joinPassword ?? '').trim().length >= 4, {
    path: ['joinPassword'],
    message: 'минимум 4 символа',
  })
  .refine((d) => new Date(d.startsAtLocal).getTime() > Date.now(), {
    path: ['startsAtLocal'],
    message: 'дата должна быть в будущем',
  })
  // Правила ниже повторяют серверные: без них форма уходит на сервер
  // и возвращается с общим «данные не прошли проверку» без указания поля
  .refine(
    (d) =>
      new Date(d.startsAtLocal).getTime() <=
      Date.now() + MAX_START_DAYS_AHEAD * 24 * 60 * 60 * 1000,
    {
      path: ['startsAtLocal'],
      message: `не дальше чем через ${MAX_START_DAYS_AHEAD} дней`,
    },
  )
  .refine(
    (d) =>
      !d.cancelDeadlineLocal ||
      new Date(d.cancelDeadlineLocal).getTime() <= new Date(d.startsAtLocal).getTime(),
    {
      path: ['cancelDeadlineLocal'],
      message: 'не позже начала игры',
    },
  );

type FormValues = z.infer<typeof createFormSchema>;

/** Серверные имена полей → имена в форме (даты и цена называются иначе). */
const SERVER_FIELD_MAP: Record<string, keyof FormValues> = {
  title: 'title',
  description: 'description',
  startsAt: 'startsAtLocal',
  cancelDeadline: 'cancelDeadlineLocal',
  durationMinutes: 'durationMinutes',
  minPlayers: 'minPlayers',
  maxPlayers: 'maxPlayers',
  pricePerPitch: 'priceRub',
  venueName: 'venueName',
  address: 'address',
  city: 'city',
};

/** Раскладывает ответ сервера по полям формы. true — что-то удалось показать. */
function applyServerFieldErrors(details: unknown, setError: UseFormSetError<FormValues>): boolean {
  if (!Array.isArray(details)) return false;
  let shown = false;
  for (const item of details) {
    if (typeof item !== 'object' || item === null) continue;
    const { field, message } = item as { field?: unknown; message?: unknown };
    if (typeof field !== 'string' || typeof message !== 'string') continue;
    const formField = SERVER_FIELD_MAP[field];
    if (!formField) continue;
    setError(formField, { type: 'server', message });
    shown = true;
  }
  return shown;
}

function defaultStartValue(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(19, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function CreateGameForm({ formToken, defaults }: CreateGameFormProps) {
  const t = useTranslations('createForm');
  const tFormats = useTranslations('formats');
  const tCommon = useTranslations('common');

  const [defaultStart] = useState(defaultStartValue);

  // Создавать игры могут только игроки с кабинетом: имя организатора
  // берётся из профиля, форма без него не открывается
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ profile: ProfileDto | null; canCreatePublic: boolean }>('/api/me'),
    staleTime: 60_000,
  });
  // Публичные игры — по согласованию с владельцем; остальным доступны
  // приватные, чтобы никто не собрал «открытую» игру и не обманул людей
  const canCreatePublic = me.data?.canCreatePublic ?? false;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      title: '',
      description: '',
      format: 'FREE',
      skillLevel: 'ANY',
      startsAtLocal: defaultStart,
      flexDuration: false,
      durationMinutes: 90,
      teamCount: 2,
      // Публичную игру создать может не каждый — ниже опция скрыта,
      // и дефолт выбирается по ответу /api/me
      visibility: 'PRIVATE_LINK',
      joinPassword: '',
      venueName: '',
      address: '',
      city: defaults.city,
      minPlayers: 2,
      maxPlayers: 10,
      priceRub: 0,
      joinAsPlayer: true,
      cancelDeadlineLocal: '',
      website: '',
    },
  });

  const [created, setCreated] = useState<CreatedGame | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    const startsAt = new Date(values.startsAtLocal);
    const cancelDeadline = values.cancelDeadlineLocal
      ? new Date(values.cancelDeadlineLocal)
      : defaultCancelDeadline(startsAt, new Date());

    try {
      const data = await apiFetch<CreatedGame>('/api/games', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          description: values.description ?? '',
          format: values.format,
          skillLevel: values.skillLevel,
          startsAt: startsAt.toISOString(),
          durationMinutes: values.flexDuration ? null : values.durationMinutes,
          teamCount: values.teamCount,
          timezone: defaults.timezone,
          minPlayers: values.minPlayers,
          maxPlayers: values.maxPlayers,
          pricePerPitch: Math.round(values.priceRub * 100),
          currency: defaults.currency,
          cancelDeadline: cancelDeadline.toISOString(),
          venueName: values.venueName,
          address: values.address,
          city: values.city,
          visibility: values.visibility,
          joinPassword:
            values.visibility === 'PRIVATE_PASSWORD' ? values.joinPassword?.trim() : undefined,
          joinAsPlayer: values.joinAsPlayer,
          website: values.website,
          formToken,
        }),
      });
      saveHostToken(data.game.code, data.hostToken);
      setCreated(data);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // Сервер присылает список {field, message} — раскладываем его по полям,
        // чтобы человек видел, что именно поправить, а не общий отказ
        applyServerFieldErrors(error.payload.details, setError);
        toast.error(error.payload.message);
        return;
      }
      toast.error(tCommon('error'));
    }
  });

  if (created) {
    return <CreatedGameScreen created={created} />;
  }

  if (me.isPending) {
    return (
      <div className="flex flex-col gap-3 py-6" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if ((me.data?.profile ?? null) === null) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-4 py-8">
        <h1 className="display text-3xl">{t('title')}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="display text-xl tracking-wide">
              {t('profileGate.title')}
            </CardTitle>
            <CardDescription>{t('profileGate.lead')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="display text-base tracking-wide">
              <Link href="/me">{t('profileGate.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const fieldError = (key: keyof FormValues) =>
    errors[key] ? (
      <p role="alert" className="text-destructive text-xs">
        {errors[key]?.message}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <h1 className="display text-3xl">{t('title')}</h1>

      {/* Honeypot: скрытое поле-ловушка для ботов */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        {...register('website')}
      />

      <Card>
        <CardHeader>
          <CardTitle className="display text-xl">{t('sections.what')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cg-title">{t('fields.title')}</Label>
            <Input
              id="cg-title"
              placeholder={t('fields.titlePlaceholder')}
              {...register('title')}
            />
            {fieldError('title')}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cg-desc">{t('fields.description')}</Label>
            <Textarea
              id="cg-desc"
              rows={3}
              placeholder={t('fields.descriptionPlaceholder')}
              {...register('description')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-starts">{t('fields.startsAt')}</Label>
            <Input id="cg-starts" type="datetime-local" {...register('startsAtLocal')} />
            {fieldError('startsAtLocal')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-duration">{t('fields.duration')}</Label>
            <Controller
              control={control}
              name="flexDuration"
              render={({ field }) => (
                <div className="flex gap-2">
                  <Input
                    id="cg-duration"
                    type="number"
                    min={30}
                    max={480}
                    step={15}
                    disabled={field.value}
                    className="flex-1"
                    {...register('durationMinutes', { valueAsNumber: true })}
                  />
                  <Button
                    type="button"
                    variant={field.value ? 'secondary' : 'outline'}
                    aria-pressed={field.value}
                    onClick={() => field.onChange(!field.value)}
                  >
                    {t('fields.durationFlex')}
                  </Button>
                </div>
              )}
            />
            {fieldError('durationMinutes')}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.format')}</Label>
            <Controller
              control={control}
              name="format"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {tFormats(format)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display text-xl">{t('sections.where')}</CardTitle>
          <CardDescription>{t('fields.coordsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cg-venue">{t('fields.venueName')}</Label>
            <Input
              id="cg-venue"
              placeholder={t('fields.venuePlaceholder')}
              {...register('venueName')}
            />
            {fieldError('venueName')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-city">{t('fields.city')}</Label>
            <Input id="cg-city" {...register('city')} />
            {fieldError('city')}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cg-address">{t('fields.address')}</Label>
            <Input
              id="cg-address"
              placeholder={t('fields.addressPlaceholder')}
              {...register('address')}
            />
            {fieldError('address')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display text-xl">{t('sections.params')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cg-max">{t('fields.maxPlayers')}</Label>
            <Input
              id="cg-max"
              type="number"
              min={4}
              max={30}
              {...register('maxPlayers', { valueAsNumber: true })}
            />
            {fieldError('maxPlayers')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-price">{t('fields.price')}</Label>
            <Input
              id="cg-price"
              type="number"
              min={0}
              step={50}
              {...register('priceRub', { valueAsNumber: true })}
            />
            <p className="text-muted-foreground text-xs">{t('fields.priceHint')}</p>
            {fieldError('priceRub')}
          </div>
          {/* Кто может записаться: публичная игра — по согласованию,
              остальным — приватная по ссылке или по паролю */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('fields.visibility')}</Label>
            <Controller
              control={control}
              name="visibility"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-1.5" role="group">
                    {GAME_VISIBILITIES.filter((value) => value !== 'PUBLIC' || canCreatePublic).map(
                      (value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={field.value === value ? 'secondary' : 'outline'}
                          aria-pressed={field.value === value}
                          onClick={() => field.onChange(value)}
                        >
                          {t(`fields.visibilityOptions.${value}`)}
                        </Button>
                      ),
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t(`fields.visibilityHints.${field.value}`)}
                  </p>
                  {field.value === 'PRIVATE_PASSWORD' ? (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="cg-password">{t('fields.joinPassword')}</Label>
                      <Input
                        id="cg-password"
                        autoComplete="off"
                        placeholder={t('fields.joinPasswordPlaceholder')}
                        {...register('joinPassword')}
                      />
                      {fieldError('joinPassword')}
                    </div>
                  ) : null}
                  {!canCreatePublic ? (
                    <p className="text-muted-foreground text-xs">{t('fields.publicLocked')}</p>
                  ) : null}
                </div>
              )}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('fields.teamCount')}</Label>
            <Controller
              control={control}
              name="teamCount"
              render={({ field }) => (
                <div className="flex gap-1.5" role="group" aria-label={t('fields.teamCount')}>
                  {[1, 2, 3, 4].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      size="sm"
                      variant={field.value === count ? 'secondary' : 'outline'}
                      aria-pressed={field.value === count}
                      onClick={() => field.onChange(count)}
                    >
                      {count === 1
                        ? t('fields.teamCountGathering')
                        : t('fields.teamCountOption', { count })}
                    </Button>
                  ))}
                </div>
              )}
            />
            <p className="text-muted-foreground text-xs">{t('fields.teamCountHint')}</p>
          </div>

          {/* Организатор чаще всего играет сам: без этой записи состав
              остаётся пустым и игру снимает фоновая уборка */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                {...register('joinAsPlayer')}
              />
              {t('fields.joinAsPlayer')}
            </label>
            <p className="text-muted-foreground text-xs">{t('fields.joinAsPlayerHint')}</p>
          </div>

          {/* Редко нужные поля спрятаны: обычному организатору хватает
              значений по умолчанию (минимум 2, дедлайн — за 6 часов) */}
          <details className="group sm:col-span-2">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium select-none">
              {t('sections.advanced')}
            </summary>
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cg-min">{t('fields.minPlayers')}</Label>
                <Input
                  id="cg-min"
                  type="number"
                  min={2}
                  max={30}
                  {...register('minPlayers', { valueAsNumber: true })}
                />
                <p className="text-muted-foreground text-xs">{t('fields.minPlayersHint')}</p>
                {fieldError('minPlayers')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cg-deadline">{t('fields.cancelDeadline')}</Label>
                <Input
                  id="cg-deadline"
                  type="datetime-local"
                  {...register('cancelDeadlineLocal')}
                />
                <p className="text-muted-foreground text-xs">{t('fields.cancelDeadlineHint')}</p>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        className="display w-full text-base tracking-wide"
        disabled={isSubmitting}
      >
        {isSubmitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

function CreatedGameScreen({ created }: { created: CreatedGame }) {
  const t = useTranslations('createForm.success');
  const tCommon = useTranslations('common');

  // Для игры «по ссылке» ключ входит в адрес: по нему и записываются
  const gameUrl =
    `${window.location.origin}/games/${created.game.code}` +
    (created.inviteKey !== null ? `?key=${created.inviteKey}` : '');

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(tCommon('copied'));
  };

  // Секретный токен пользователю больше не показываем: организатор
  // управляет игрой через кабинет. Токен тихо лежит в localStorage
  // как запасной ключ для этого браузера (старый механизм жив).
  return (
    <div className="space-y-6">
      <h1 className="display text-3xl">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardDescription className="eyebrow">{t('codeLabel')}</CardDescription>
          <CardTitle className="text-lamp digits text-4xl tracking-wider">
            {created.game.code}
          </CardTitle>
          <CardDescription>{t('managedByProfile')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created.game.visibility !== 'PUBLIC' ? (
            <p className="text-muted-foreground text-sm">
              {created.inviteKey !== null ? t('privateLinkHint') : t('privatePasswordHint')}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => void copy(gameUrl)}>
              <Copy className="size-4" /> {t('copyLink')}
            </Button>
            <Button asChild className="flex-1">
              <Link href={`/games/${created.game.code}`}>
                <ExternalLink className="size-4" /> {t('goToGame')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
