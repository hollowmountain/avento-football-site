'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * Табло обратного отсчёта — главный элемент страницы игры.
 * Обновляется раз в 30 секунд; цифры моноширинные, чтобы не дёргались.
 */
export function Countdown({ startsAtIso }: { startsAtIso: string }) {
  const t = useTranslations('game.countdown');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const msLeft = new Date(startsAtIso).getTime() - now;

  if (msLeft <= 0) {
    return (
      <p className="eyebrow text-muted-foreground border-y py-3 text-center">{t('started')}</p>
    );
  }

  const totalMinutes = Math.floor(msLeft / 60_000);
  const cells = [
    { value: Math.floor(totalMinutes / (60 * 24)), unit: t('unitDays') },
    { value: Math.floor((totalMinutes % (60 * 24)) / 60), unit: t('unitHours') },
    { value: totalMinutes % 60, unit: t('unitMinutes') },
  ];

  return (
    <div
      className="border-border bg-border grid grid-cols-3 gap-px border-y"
      role="timer"
      aria-label={t('starts')}
    >
      {cells.map((cell) => (
        <div
          key={cell.unit}
          className="bg-background flex flex-col items-center gap-0.5 py-3"
          suppressHydrationWarning
        >
          {/* lamp, а не primary: в светлой теме чистый янтарь на бумаге
              даёт контраст ~1.6:1 и цифры перестают читаться */}
          <span className="text-lamp display digits text-5xl leading-none">
            {String(cell.value).padStart(2, '0')}
          </span>
          <span className="eyebrow text-muted-foreground">{cell.unit}</span>
        </div>
      ))}
    </div>
  );
}
