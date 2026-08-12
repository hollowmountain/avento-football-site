import type { ReactNode } from 'react';

type PillTone = 'default' | 'accent' | 'muted';

const TONES: Record<PillTone, string> = {
  default: 'border-border text-muted-foreground',
  // Янтарь контуром, а не заливкой: залитый янтарный блок остаётся
  // только у главного действия, поэтому иерархия читается однозначно
  accent: 'border-primary text-lamp',
  muted: 'border-border text-muted-foreground',
};

/** Служебная метка табло: прямоугольная, моноширинная, капсом. */
export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span
      className={`rounded-sm border px-2 py-0.5 font-mono text-[0.66rem] tracking-[0.1em] whitespace-nowrap uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
