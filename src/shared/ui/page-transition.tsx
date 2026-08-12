'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Перезапускает анимацию появления на каждом маршруте: смена key
 * заставляет React пересоздать узел, и CSS-анимация проигрывается заново.
 * Сама анимация описана классом .page-enter в globals.css.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
