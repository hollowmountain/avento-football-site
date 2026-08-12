'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { defaultTeams } from './default-teams';
import { DEMO_SCENES, DEMO_STEP_KEYS } from './demo-scenes';
import { startDayIfAbsent } from './quick-day-store';

/**
 * Тур «как работает» на 10 шагов. Требование заказчика: объяснение яркое,
 * фон за ним чуть темнее — сцена-иллюстрация лежит под вуалью
 * bg-background/70, карточка шага остаётся на полной яркости.
 */
export function QuickDemoClient() {
  const t = useTranslations('quick.demo');
  const tDefaults = useTranslations('quick.teamDefaults');
  const router = useRouter();
  const [step, setStep] = useState(0);

  const stepKey = DEMO_STEP_KEYS[Math.min(step, DEMO_STEP_KEYS.length - 1)] ?? 'arrive';
  const Scene = DEMO_SCENES[stepKey];
  const isLast = step === DEMO_STEP_KEYS.length - 1;

  const begin = () => {
    // Из тура выходим сразу в начатый день; идущий день не затираем
    startDayIfAbsent(defaultTeams((colorId) => tDefaults(colorId), 2));
    router.push('/quick');
  };

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <header className="flex items-baseline gap-3">
        <h1 className="display text-3xl leading-none tracking-tight">{t('title')}</h1>
        <span className="digits text-muted-foreground ml-auto text-sm" aria-live="polite">
          {t('progress', { current: step + 1, total: DEMO_STEP_KEYS.length })}
        </span>
      </header>

      {/* key перезапускает появление шага; при reduced-motion анимации нет */}
      <div
        key={stepKey}
        className="relative overflow-hidden rounded-xl border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
      >
        <div aria-hidden className="pointer-events-none select-none">
          <Scene />
        </div>
        {/* Вуаль: сцена чуть темнее, внимание — на карточке шага */}
        <div className="bg-background/70 absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <div className="border-primary/40 bg-popover flex flex-col gap-1.5 rounded-xl border p-4 shadow-xl">
            <p className="eyebrow text-lamp">{t('stepLabel', { number: step + 1 })}</p>
            <h2 className="display text-2xl leading-none tracking-wide">
              {t(`steps.${stepKey}.title`)}
            </h2>
            <p className="text-muted-foreground text-sm">{t(`steps.${stepKey}.text`)}</p>
          </div>
        </div>
      </div>

      <footer className="flex items-center gap-2">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link href="/quick">{t('skip')}</Link>
        </Button>
        {isLast ? (
          <Button
            type="button"
            size="lg"
            className="display ml-auto text-base tracking-wide"
            onClick={begin}
          >
            {t('start')}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="display ml-auto text-base tracking-wide"
            onClick={() => setStep((current) => Math.min(current + 1, DEMO_STEP_KEYS.length - 1))}
          >
            {t('next')}
          </Button>
        )}
      </footer>
    </section>
  );
}
