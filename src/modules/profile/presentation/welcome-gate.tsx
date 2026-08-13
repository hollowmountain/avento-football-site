'use client';

import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
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
 * Первый заход на сайт: предлагаем завести кабинет или остаться гостем.
 * Выбор запоминается в localStorage — окно не навязывается повторно.
 * Чтение localStorage — через useSyncExternalStore: на сервере и до
 * гидратации отвечаем «выбор сделан», чтобы не мигать диалогом.
 */
const WELCOME_KEY = 'avento_welcome_v1';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function useWelcomeChoice(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(WELCOME_KEY),
    () => 'pending',
  );
}

export function WelcomeGate() {
  const t = useTranslations('welcome');
  const pathname = usePathname();
  const choice = useWelcomeChoice();
  const [closed, setClosed] = useState(false);

  // Кабинет спрашиваем только когда выбор ещё не сделан
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<{ profile: ProfileDto | null }>('/api/me'),
    enabled: choice === null && !closed,
    staleTime: 60_000,
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(WELCOME_KEY, 'guest');
    } catch {
      // приватный режим: выбор доживёт до перезагрузки через closed
    }
    setClosed(true);
  };

  // На странице кабинета человек уже там, куда ведёт окно
  if (pathname === '/me') return null;
  if (closed || choice !== null) return null;
  if (me.data?.profile === undefined || me.data.profile !== null) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : dismiss())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display text-2xl tracking-wide">{t('title')}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="display text-base tracking-wide" onClick={dismiss}>
            <Link href="/me">
              <UserRound data-icon="inline-start" aria-hidden />
              {t('register')}
            </Link>
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={dismiss}>
            {t('guest')}
          </Button>
          <p className="text-muted-foreground text-xs">{t('hint')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
