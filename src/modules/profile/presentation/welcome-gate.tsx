'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ListOrdered, UserRound, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { apiFetch } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import type { ProfileDto } from '../schemas';

/**
 * Окно-знакомство при заходе на сайт: что здесь есть и куда жать.
 * Показывается раз за визит (sessionStorage), «Больше не показывать» —
 * навсегда (localStorage). Чтение хранилищ — useSyncExternalStore,
 * на сервере и до гидратации отвечаем «скрыто», чтобы не мигать.
 */
const NEVER_KEY = 'avento_welcome_v2_never';
const SEEN_KEY = 'avento_welcome_v2_seen';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function useWelcomeHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      window.localStorage.getItem(NEVER_KEY) !== null ||
      window.sessionStorage.getItem(SEEN_KEY) !== null,
    () => true,
  );
}

export function WelcomeGate() {
  const t = useTranslations('welcome');
  const pathname = usePathname();
  const hidden = useWelcomeHidden();
  const [closed, setClosed] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ profile: ProfileDto | null }>('/api/me'),
    enabled: !hidden && !closed,
    staleTime: 60_000,
  });

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
      if (neverAgain) window.localStorage.setItem(NEVER_KEY, '1');
    } catch {
      // приватный режим: выбор доживёт до перезагрузки через closed
    }
    setClosed(true);
  };

  // На странице кабинета не мешаем — человек уже разбирается
  if (pathname === '/me') return null;
  if (hidden || closed || me.data === undefined) return null;

  const hasProfile = me.data.profile !== null;

  const items = [
    { icon: ListOrdered, title: t('items.feedTitle'), text: t('items.feedText') },
    { icon: CalendarPlus, title: t('items.createTitle'), text: t('items.createText') },
    { icon: Zap, title: t('items.quickTitle'), text: t('items.quickText') },
    { icon: UserRound, title: t('items.profileTitle'), text: t('items.profileText') },
  ];

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : dismiss())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-2xl tracking-wide">{t('title')}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <item.icon className="text-lamp mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 text-sm">
                <span className="font-semibold">{item.title}</span>{' '}
                <span className="text-muted-foreground">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          {!hasProfile ? (
            <Button asChild size="lg" className="display text-base tracking-wide" onClick={dismiss}>
              <Link href="/me">
                <UserRound data-icon="inline-start" aria-hidden />
                {t('register')}
              </Link>
            </Button>
          ) : null}
          {/* Обе кнопки — узким капсом одного размера: равнозначные пункты
              не должны различаться шрифтом (правило шапки) */}
          <Button
            type="button"
            variant={hasProfile ? 'default' : 'outline'}
            size="lg"
            className="display text-base tracking-wide"
            onClick={dismiss}
          >
            {hasProfile ? t('gotIt') : t('guest')}
          </Button>
          <label className="text-muted-foreground flex items-center gap-2 text-xs select-none">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={neverAgain}
              onChange={(event) => setNeverAgain(event.target.checked)}
            />
            {t('dontShowAgain')}
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
