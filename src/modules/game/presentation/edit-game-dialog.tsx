'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiRequestError, apiFetch } from '@/shared/lib/api-client';
import { toDatetimeLocalValue } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import type { GameSummaryDto } from './dto';

/**
 * Правка игры организатором. Отправляем только изменённые поля: PATCH
 * на сервере пересчитывает координаты по адресу и поднимает очередь
 * ожидания, если мест стало больше.
 */
export function EditGameDialog({
  game,
  hostToken,
  onClose,
  onSaved,
}: {
  game: GameSummaryDto;
  hostToken: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('game.edit');
  const tFields = useTranslations('createForm.fields');
  const tCommon = useTranslations('common');

  const [title, setTitle] = useState(game.title);
  const [description, setDescription] = useState(game.description ?? '');
  const [startsAtLocal, setStartsAtLocal] = useState(() =>
    toDatetimeLocalValue(new Date(game.startsAt)),
  );
  const [venueName, setVenueName] = useState(game.venueName);
  const [address, setAddress] = useState(game.address);
  const [city, setCity] = useState(game.city);
  const [maxPlayers, setMaxPlayers] = useState(String(game.maxPlayers));
  const [priceRub, setPriceRub] = useState(String(game.pricePerPitch / 100));
  const [teamCount, setTeamCount] = useState(game.teamCount);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch(`/api/games/${game.code}`, {
        method: 'PATCH',
        headers: hostToken ? { 'x-host-token': hostToken } : {},
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      toast.success(t('saved'));
      onSaved();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.payload.message : tCommon('error'));
    },
  });

  const submit = () => {
    const patch: Record<string, unknown> = {};
    if (title.trim() !== game.title) patch.title = title.trim();
    if (description.trim() !== (game.description ?? '')) patch.description = description.trim();
    const startsAt = new Date(startsAtLocal);
    if (startsAt.toISOString() !== game.startsAt) patch.startsAt = startsAt.toISOString();
    if (venueName.trim() !== game.venueName) patch.venueName = venueName.trim();
    if (address.trim() !== game.address) patch.address = address.trim();
    if (city.trim() !== game.city) patch.city = city.trim();
    const max = Number(maxPlayers);
    if (Number.isFinite(max) && max !== game.maxPlayers) patch.maxPlayers = max;
    const price = Math.round(Number(priceRub) * 100);
    if (Number.isFinite(price) && price !== game.pricePerPitch) patch.pricePerPitch = price;
    if (teamCount !== game.teamCount) patch.teamCount = teamCount;

    // Пустой PATCH сервер отвергает — и правильно, менять нечего
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    save.mutate(patch);
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-xl tracking-wide">{t('title')}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="eg-title">{t('name')}</Label>
            <Input id="eg-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eg-desc">{t('description')}</Label>
            <Textarea
              id="eg-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eg-starts">{t('startsAt')}</Label>
            <Input
              id="eg-starts"
              type="datetime-local"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eg-venue">{t('venue')}</Label>
              <Input
                id="eg-venue"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eg-city">{t('city')}</Label>
              <Input id="eg-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eg-address">{t('address')}</Label>
            <Input id="eg-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <p className="text-muted-foreground text-xs">{t('addressHint')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eg-max">{t('maxPlayers')}</Label>
              <Input
                id="eg-max"
                type="number"
                min={4}
                max={30}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eg-price">{t('price')}</Label>
              <Input
                id="eg-price"
                type="number"
                min={0}
                step={50}
                value={priceRub}
                onChange={(e) => setPriceRub(e.target.value)}
              />
            </div>
          </div>

          {/* Число команд можно поменять и после создания: планы меняются */}
          <div className="space-y-1.5">
            <Label>{tFields('teamCount')}</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={tFields('teamCount')}>
              {[1, 2, 3, 4].map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={teamCount === count ? 'secondary' : 'outline'}
                  aria-pressed={teamCount === count}
                  onClick={() => setTeamCount(count)}
                >
                  {count === 1
                    ? tFields('teamCountGathering')
                    : tFields('teamCountOption', { count })}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{tFields('teamCountHint')}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
