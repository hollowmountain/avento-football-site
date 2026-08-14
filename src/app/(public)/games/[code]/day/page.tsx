import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMatchDayView } from '@/modules/game/presentation/get-matchday-view';
import { MatchDayClient } from '@/modules/game/presentation/matchday-client';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type DayPageProps = PageProps<'/games/[code]/day'>;

export async function generateMetadata({ params }: DayPageProps): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations('matchday');
  return { title: `${t('title')} · ${code.toUpperCase()}` };
}

/** Протокол матч-дня. Смотреть может любой, вести — менеджер игры. */
export default async function MatchDayPage({ params }: DayPageProps) {
  const { code } = await params;
  const cookieStore = await cookies();
  const viewerToken = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  const view = await getMatchDayView(code, viewerToken, null);
  if (view === null) notFound();

  return <MatchDayClient code={view.game.code} initialData={view} />;
}
