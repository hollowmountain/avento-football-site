import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { QuickDemoClient } from '@/modules/quick/presentation/demo-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('quick.demo');
  return { title: t('title') };
}

/** Обучающий тур по режиму «Быстрая игра»: 10 шагов заказчика. */
export default function QuickDemoPage() {
  return <QuickDemoClient />;
}
