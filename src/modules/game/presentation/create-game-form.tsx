'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { toDatetimeLocalValue } from '@/shared/lib/format';
import { saveHostToken } from '@/shared/lib/host-tokens';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { GAME_FORMATS, SKILL_LEVELS, type formTokenSchema } from '../schemas';
import type { GameDto } from './dto';

interface CreateGameFormProps {
  formToken: z.infer<typeof formTokenSchema>;
  defaults: { city: string; currency: string; timezone: string };
}

type CreatedGame = { game: GameDto; hostToken: string };

const createFormSchema = z
  .object({
    title: z.string().trim().min(3, 'минимум 3 симв.').max(80),
    description: z.string().max(2000).optional(),
    format: z.enum(GAME_FORMATS),
    skillLevel: z.enum(SKILL_LEVELS),
    startsAtLocal: z.string().min(1, 'укажите дату'),
    durationMinutes: z.number({ message: 'число' }).int().min(30).max(480),
    venueName: z.string().trim().min(2, 'минимум 2 симв.').max(80),
    address: z.string().trim().min(3, 'минимум 3 симв.').max(160),
    city: z.string().trim().min(2, 'минимум 2 симв.').max(60),
    latitude: z.number({ message: 'число, например 55.7558' }).min(-90).max(90),
    longitude: z.number({ message: 'число, например 37.6173' }).min(-180).max(180),
    minPlayers: z.number({ message: 'число' }).int().min(2).max(30),
    maxPlayers: z.number({ message: 'число' }).int().min(4).max(30),
    priceRub: z.number({ message: 'число' }).min(0).max(1_000_000),
    cancelDeadlineLocal: z.string().optional(),
    hostName: z.string().trim().min(2, 'минимум 2 симв.').max(60),
    website: z.string().optional(),
  })
  .refine((d) => d.maxPlayers >= d.minPlayers, {
    path: ['maxPlayers'],
    message: 'не меньше минимума',
  })
  .refine((d) => new Date(d.startsAtLocal).getTime() > Date.now(), {
    path: ['startsAtLocal'],
    message: 'дата должна быть в будущем',
  });

type FormValues = z.infer<typeof createFormSchema>;

function defaultStartValue(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(19, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function CreateGameForm({ formToken, defaults }: CreateGameFormProps) {
  const t = useTranslations('createForm');
  const tFormats = useTranslations('formats');
  const tLevels = useTranslations('levels');
  const tCommon = useTranslations('common');

  const [defaultStart] = useState(defaultStartValue);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      title: '',
      description: '',
      format: 'FIVE_A_SIDE',
      skillLevel: 'ANY',
      startsAtLocal: defaultStart,
      durationMinutes: 90,
      venueName: '',
      address: '',
      city: defaults.city,
      minPlayers: 6,
      maxPlayers: 10,
      priceRub: 0,
      cancelDeadlineLocal: '',
      hostName: '',
      website: '',
    },
  });

  const [created, setCreated] = useState<CreatedGame | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    const startsAt = new Date(values.startsAtLocal);
    const cancelDeadline = values.cancelDeadlineLocal
      ? new Date(values.cancelDeadlineLocal)
      : new Date(startsAt.getTime() - 6 * 60 * 60 * 1000);

    try {
      const data = await apiFetch<CreatedGame>('/api/games', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          description: values.description ?? '',
          format: values.format,
          skillLevel: values.skillLevel,
          startsAt: startsAt.toISOString(),
          durationMinutes: values.durationMinutes,
          timezone: defaults.timezone,
          minPlayers: values.minPlayers,
          maxPlayers: values.maxPlayers,
          pricePerPitch: Math.round(values.priceRub * 100),
          currency: defaults.currency,
          cancelDeadline: cancelDeadline.toISOString(),
          venueName: values.venueName,
          address: values.address,
          latitude: values.latitude,
          longitude: values.longitude,
          city: values.city,
          hostName: values.hostName,
          website: values.website,
          formToken,
        }),
      });
      saveHostToken(data.game.code, data.hostToken);
      setCreated(data);
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.payload.message : tCommon('error');
      toast.error(message);
    }
  });

  if (created) {
    return <CreatedGameScreen created={created} />;
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
            <Input
              id="cg-duration"
              type="number"
              min={30}
              max={480}
              step={15}
              {...register('durationMinutes', { valueAsNumber: true })}
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
          <div className="space-y-1.5">
            <Label>{t('fields.skillLevel')}</Label>
            <Controller
              control={control}
              name="skillLevel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {tLevels(level)}
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
          <div className="space-y-1.5">
            <Label htmlFor="cg-lat">{t('fields.latitude')}</Label>
            <Input
              id="cg-lat"
              type="number"
              step="any"
              placeholder="55.7558"
              {...register('latitude', { valueAsNumber: true })}
            />
            {fieldError('latitude')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-lon">{t('fields.longitude')}</Label>
            <Input
              id="cg-lon"
              type="number"
              step="any"
              placeholder="37.6173"
              {...register('longitude', { valueAsNumber: true })}
            />
            {fieldError('longitude')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display text-xl">{t('sections.params')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cg-min">{t('fields.minPlayers')}</Label>
            <Input
              id="cg-min"
              type="number"
              min={2}
              max={30}
              {...register('minPlayers', { valueAsNumber: true })}
            />
            {fieldError('minPlayers')}
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="cg-deadline">{t('fields.cancelDeadline')}</Label>
            <Input id="cg-deadline" type="datetime-local" {...register('cancelDeadlineLocal')} />
            <p className="text-muted-foreground text-xs">{t('fields.cancelDeadlineHint')}</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cg-host">{t('fields.hostName')}</Label>
            <Input id="cg-host" {...register('hostName')} />
            {fieldError('hostName')}
          </div>
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
  const [tokenCopied, setTokenCopied] = useState(false);

  const gameUrl = `${window.location.origin}/games/${created.game.code}`;

  const copy = async (value: string, onDone?: () => void) => {
    await navigator.clipboard.writeText(value);
    toast.success(tCommon('copied'));
    onDone?.();
  };

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardDescription className="eyebrow">{t('codeLabel')}</CardDescription>
          <CardTitle className="text-lamp font-mono text-4xl tracking-wider">
            {created.game.code}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>{t('tokenTitle')}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{t('tokenWarning')}</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted block flex-1 overflow-x-auto rounded px-2 py-1.5 text-xs">
                  {created.hostToken}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={tCommon('copy')}
                  onClick={() => void copy(created.hostToken, () => setTokenCopied(true))}
                >
                  {tokenCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t('tokenSaved')}</p>
            </AlertDescription>
          </Alert>
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
