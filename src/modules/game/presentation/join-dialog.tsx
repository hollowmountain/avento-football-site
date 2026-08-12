'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ATTENDANCE, POSITIONS, SKILL_LEVELS, type formTokenSchema } from '../schemas';
import type { ParticipantDto } from './dto';

const joinFormSchema = z.object({
  name: z.string().trim().min(2, 'минимум 2 симв.').max(60),
  nickname: z
    .string()
    .trim()
    .min(2, 'минимум 2 симв.')
    .max(24, 'максимум 24 симв.')
    .regex(/^[\p{L}\p{N} _.-]+$/u, 'только буквы, цифры, пробел и _ . -'),
  position: z.enum(POSITIONS),
  skillLevel: z.enum(SKILL_LEVELS),
  attendance: z.enum(ATTENDANCE),
  website: z.string().optional(),
});

type JoinFormValues = z.infer<typeof joinFormSchema>;

interface JoinDialogProps {
  gameCode: string;
  isFull: boolean;
  formToken: z.infer<typeof formTokenSchema>;
  onJoined: () => void;
}

export function JoinDialog({ gameCode, isFull, formToken, onJoined }: JoinDialogProps) {
  const t = useTranslations('joinForm');
  const tGame = useTranslations('game');
  const tPositions = useTranslations('positions');
  const tLevels = useTranslations('levels');
  const tAttendance = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: {
      name: '',
      nickname: '',
      position: 'ANY',
      skillLevel: 'ANY',
      attendance: 'CONFIRMED',
      website: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await apiFetch<{ participant: ParticipantDto }>(
        `/api/games/${gameCode}/participants`,
        { method: 'POST', body: JSON.stringify({ ...values, formToken }) },
      );
      toast.success(data.participant.role === 'WAITLIST' ? t('waitlisted') : t('joined'));
      setOpen(false);
      onJoined();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1" variant={isFull ? 'secondary' : 'default'}>
          {isFull ? tGame('joinWaitlist') : tGame('join')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('position')}</Label>
              <Controller
                control={control}
                name="position"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((position) => (
                        <SelectItem key={position} value={position}>
                          {tPositions(position)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('skillLevel')}</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label>{t('attendance')}</Label>
            <Controller
              control={control}
              name="attendance"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
