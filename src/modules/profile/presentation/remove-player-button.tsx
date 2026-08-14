'use client';

import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

/**
 * Удаление кабинета владельцем сайта — чистка тестовых профилей.
 * Всегда через подтверждение: отменить удаление нельзя.
 */
export function RemovePlayerButton({
  playerId,
  playerName,
  playerTag,
}: {
  playerId: string;
  playerName: string;
  playerTag: string;
}) {
  const t = useTranslations('players.remove');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/players/${playerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('done', { name: playerName }));
      setOpen(false);
      router.refresh();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('action', { name: playerName })}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>

      {open ? (
        <Dialog open onOpenChange={(next) => (next ? undefined : setOpen(false))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="display text-lg tracking-wide">{t('title')}</DialogTitle>
              <DialogDescription>
                {t('lead', { name: playerName, tag: playerTag })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {t('confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
