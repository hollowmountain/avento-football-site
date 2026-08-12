'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** Обратный отсчёт до начала игры; обновляется раз в 30 секунд. */
export function Countdown({ startsAtIso }: { startsAtIso: string }) {
  const t = useTranslations('game.countdown');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const msLeft = new Date(startsAtIso).getTime() - now;
  if (msLeft <= 0) {
    return <span className="text-muted-foreground text-sm">{t('started')}</span>;
  }

  const totalMinutes = Math.floor(msLeft / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [
    days > 0 ? t('days', { count: days }) : null,
    days > 0 || hours > 0 ? t('hours', { count: hours }) : null,
    days === 0 ? t('minutes', { count: minutes }) : null,
  ].filter(Boolean);

  return (
    <span className="text-sm tabular-nums" suppressHydrationWarning>
      {t('starts')}: {parts.join(' ')}
    </span>
  );
}
