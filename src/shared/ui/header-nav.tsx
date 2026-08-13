'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/shared/ui/button';

export interface HeaderNavItem {
  href: string;
  label: string;
}

/**
 * Пункты шапки — одинаковые оранжевые «таблетки», как «Создать игру».
 * Текущий раздел затемнён: читается и как «вы здесь», и как кнопка.
 */
export function HeaderNav({ items }: { items: HeaderNavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Button
            key={item.href}
            asChild
            size="sm"
            className={`display text-sm tracking-wide ${
              active
                ? 'bg-[color-mix(in_oklch,var(--primary),black_30%)] hover:bg-[color-mix(in_oklch,var(--primary),black_38%)]'
                : ''
            }`}
          >
            <Link href={item.href} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          </Button>
        );
      })}
    </>
  );
}
