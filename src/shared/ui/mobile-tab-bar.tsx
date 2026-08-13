'use client';

import { CalendarPlus, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

export interface MobileTabItem {
  href: string;
  label: string;
  icon: 'create' | 'quick' | 'players';
}

const ICONS: Record<MobileTabItem['icon'], ComponentType<{ className?: string }>> = {
  create: CalendarPlus,
  quick: Zap,
  players: Users,
};

/**
 * Нижняя панель на телефоне: три основных раздела под большим пальцем.
 * На десктопе не показывается — там те же пункты живут в шапке.
 * Отступ снизу учитывает «шторку» iPhone (safe-area).
 */
export function MobileTabBar({ items }: { items: MobileTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      aria-label="Основные разделы"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible:ring-ring flex flex-col items-center gap-1 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  active ? 'text-lamp' : 'text-muted-foreground'
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
