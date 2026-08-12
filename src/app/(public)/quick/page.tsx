import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { QuickClient } from '@/modules/quick/presentation/quick-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('quick');
  return { title: t('title'), description: t('intro.lead') };
}

/** Режим матч-дня: полностью клиентский, состояние — в localStorage. */
export default function QuickPage() {
  return <QuickClient />;
}
