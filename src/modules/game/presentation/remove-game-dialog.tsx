'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Textarea } from '@/shared/ui/textarea';
import { REMOVAL_REASONS } from '../schemas';

/**
 * Снятие игры владельцем сайта. Причина обязательна: её увидят
 * участники в своём кабинете, поэтому «просто удалить» здесь нельзя.
 */
export function RemoveGameDialog({
  code,
  title,
  onClose,
  onRemoved,
}: {
  code: string;
  title: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState<(typeof REMOVAL_REASONS)[number]>('WRONG_TITLE');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/games/${code}/removal`, {
        method: 'POST',
        body: JSON.stringify({ reason, note: note.trim() === '' ? null : note.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('removed'));
      onRemoved();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  const needsNote = reason === 'OTHER' && note.trim() === '';

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-lg tracking-wide">{t('removeTitle')}</DialogTitle>
          <DialogDescription>
            «{title}» — {t('removeLead')}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t('reasonLegend')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {REMOVAL_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={reason === option}
                onClick={() => setReason(option)}
                className={`focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  reason === option
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {t(`reason.${option}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Textarea
            rows={2}
            maxLength={200}
            value={note}
            placeholder={t('notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{t('noteHint')}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending || needsNote}
            onClick={() => mutation.mutate()}
          >
            {t('removeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
