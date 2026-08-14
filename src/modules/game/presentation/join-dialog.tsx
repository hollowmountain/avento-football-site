'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { ProfileDto } from '@/modules/profile/schemas';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Skeleton } from '@/shared/ui/skeleton';
import { ATTENDANCE, type formTokenSchema } from '../schemas';
import type { ParticipantDto } from './dto';

const joinFormSchema = z.object({
  name: z.string().trim().min(2, 'минимум 2 симв.').max(60),
  nickname: z
    .string()
    .trim()
    .min(2, 'минимум 2 симв.')
    .max(24, 'максимум 24 симв.')
    .regex(/^[\p{L}\p{N} _.-]+$/u, 'только буквы, цифры, пробел и _ . -'),
  attendance: z.enum(ATTENDANCE),
  /** Пароль приватной игры; для «по ссылке» ключ берётся из адреса. */
  password: z.string().optional(),
  website: z.string().optional(),
});

type JoinFormValues = z.infer<typeof joinFormSchema>;

interface JoinDialogProps {
  gameCode: string;
  isFull: boolean;
  /** PUBLIC | PRIVATE_LINK | PRIVATE_PASSWORD. */
  visibility: string;
  formToken: z.infer<typeof formTokenSchema>;
  onJoined: () => void;
}

export function JoinDialog({ gameCode, isFull, visibility, formToken, onJoined }: JoinDialogProps) {
  const t = useTranslations('joinForm');
  const tGame = useTranslations('game');
  const [open, setOpen] = useState(false);

  // Кабинет устройства: форма префиллится ФИО и тегом, если профиль есть.
  // Запрос идёт только после открытия диалога, форма ждёт ответа —
  // так defaultValues заполняются один раз, без reset() в эффектах.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ profile: ProfileDto | null }>('/api/me'),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="display flex-1 text-base tracking-wide"
          variant={isFull ? 'secondary' : 'default'}
        >
          {isFull ? tGame('joinWaitlist') : tGame('join')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-2xl">{t('title')}</DialogTitle>
        </DialogHeader>
        {me.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <JoinForm
            gameCode={gameCode}
            visibility={visibility}
            formToken={formToken}
            profile={me.data?.profile ?? null}
            onJoined={() => {
              setOpen(false);
              onJoined();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function JoinForm({
  gameCode,
  visibility,
  formToken,
  profile,
  onJoined,
}: {
  gameCode: string;
  visibility: string;
  formToken: z.infer<typeof formTokenSchema>;
  profile: ProfileDto | null;
  onJoined: () => void;
}) {
  const t = useTranslations('joinForm');
  const tAttendance = useTranslations('attendance');
  const tCommon = useTranslations('common');
  // Ключ приватной игры «по ссылке» лежит в адресе — читаем один раз,
  // при рендере обращаться к window нельзя (гидратация)
  const [linkKey] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('key') ?? ''),
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: {
      name: profile?.displayName ?? '',
      nickname: profile?.tag ?? '',
      attendance: 'CONFIRMED',
      password: '',
      website: '',
    },
  });

  const hasProfile = profile !== null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Приватная игра: ключ из ссылки либо пароль от организатора
      const joinKey = visibility === 'PRIVATE_PASSWORD' ? (values.password ?? '').trim() : linkKey;
      // У владельца кабинета имя и ник берёт сервер из профиля
      const body = hasProfile
        ? { attendance: values.attendance, joinKey, website: values.website, formToken }
        : { ...values, joinKey, formToken };
      const data = await apiFetch<{ participant: ParticipantDto }>(
        `/api/games/${gameCode}/participants`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      toast.success(data.participant.role === 'WAITLIST' ? t('waitlisted') : t('joined'));
      onJoined();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        {...register('website')}
      />
      {/* С кабинетом спрашивать имя и ник незачем — они уже в профиле */}
      {hasProfile ? (
        <p className="text-sm">{t('asProfile', { name: profile.displayName, tag: profile.tag })}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="join-name">{t('name')}</Label>
            <Input id="join-name" placeholder={t('namePlaceholder')} {...register('name')} />
            {errors.name ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-nickname">{t('nickname')}</Label>
            <Input
              id="join-nickname"
              placeholder={t('nicknamePlaceholder')}
              {...register('nickname')}
            />
            <p className="text-muted-foreground text-xs">{t('nicknameHint')}</p>
            {errors.nickname ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.nickname.message}
              </p>
            ) : null}
          </div>
        </>
      )}
      {/* Приватная игра: пароль спрашиваем, ключ из ссылки уже в адресе */}
      {visibility === 'PRIVATE_PASSWORD' ? (
        <div className="space-y-1.5">
          <Label htmlFor="join-password">{t('password')}</Label>
          <Input id="join-password" type="password" autoComplete="off" {...register('password')} />
          <p className="text-muted-foreground text-xs">{t('passwordHint')}</p>
        </div>
      ) : null}
      {visibility === 'PRIVATE_LINK' && linkKey === '' ? (
        <p role="alert" className="text-destructive text-xs">
          {t('linkOnly')}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label>{t('attendance')}</Label>
        <Controller
          control={control}
          name="attendance"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
              {ATTENDANCE.map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem id={`att-${value}`} value={value} />
                  <Label htmlFor={`att-${value}`} className="font-normal">
                    {tAttendance(value)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </div>
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
