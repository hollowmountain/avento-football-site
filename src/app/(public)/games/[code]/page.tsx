import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { GamePageClient } from '@/modules/game/presentation/game-page-client';
import { getGameView } from '@/modules/game/presentation/get-game-view';
import { env } from '@/shared/lib/env';
import { issueFormToken } from '@/shared/security/anti-abuse';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type GamePageProps = PageProps<'/games/[code]'>;

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { code } = await params;
  const view = await getGameView(code, null, null);
  if (!view) return {};
  const t = await getTranslations('feed.card');
  return {
    title: view.game.title,
    description: `${view.game.venueName}, ${view.game.city} · ${t('players', {
      main: view.game.mainCount,
      max: view.game.maxPlayers,
    })}`,
  };
}

export default async function GamePage({ params }: GamePageProps) {
  lazySweep();

  const { code } = await params;
  const cookieStore = await cookies();
  const viewerToken = cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null;

  const view = await getGameView(code, viewerToken, null);
  if (!view) notFound();

  const formToken = issueFormToken(env.TOKEN_PEPPER, new Date());

  return <GamePageClient code={view.game.code} initialData={view} formToken={formToken} />;
}
