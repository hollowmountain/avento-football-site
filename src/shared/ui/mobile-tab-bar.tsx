'use client';

import { CalendarPlus, ListOrdered, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

export interface MobileTabItem {
  href: string;
  label: string;
  icon: 'create' | 'games' | 'quick' | 'players';
}

const ICONS: Record<MobileTabItem['icon'], ComponentType<{ className?: string }>> = {
  create: CalendarPlus,
  games: ListOrdered,
  quick: Zap,
  players: Users,
};

/**
 * Нижняя панель на телефоне: три основных раздела под большим пальцем,
 * янтарным контейнером с медленным переливом (см. .tab-gradient).
 * На десктопе не показывается — там те же пункты живут в шапке.
 * Отступ снизу учитывает «шторку» iPhone (safe-area).
 */
export function MobileTabBar({ items }: { items: MobileTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
      aria-label="Основные разделы"
    >
      <ul className="tab-gradient mx-auto grid max-w-md grid-cols-4 overflow-hidden rounded-2xl shadow-lg shadow-black/25">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          // Лента живёт на «/», а с ней совпадает начало любого адреса —
          // поэтому корень сверяем целиком, иначе подсветятся все разделы
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // Текст тёмный: он лежит на янтарной заливке, а не на фоне
                className={`text-primary-foreground focus-visible:ring-primary-foreground/60 flex flex-col items-center gap-1 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  // Активный раздел отличается только заливкой, не шрифтом
                  active ? 'bg-black/15' : ''
                }`}
              >
                <Icon className="size-5" />
                <span className="display text-[0.7rem] tracking-wide">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
