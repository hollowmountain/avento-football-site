import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileClient } from '@/modules/profile/presentation/profile-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('title') };
}

/** Личный кабинет: профиль с тегом, личный код входа. */
export default function MePage() {
  return <ProfileClient />;
}
