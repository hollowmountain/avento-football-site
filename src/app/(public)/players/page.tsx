import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { PlayersList } from '@/modules/profile/presentation/players-list';
import { profileByDeviceToken } from '@/modules/profile/server';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

const PLAYERS_LIMIT = 200;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('players');
  return { title: t('title'), description: t('lead') };
}

/** База игроков: все, у кого есть кабинет. */
export default async function PlayersPage() {
  const t = await getTranslations('players');
  const players = await getProfileDeps().profiles.listPlayers(PLAYERS_LIMIT);

  // Владельцу сайта здесь доступна чистка кабинетов; права всё равно
  // перепроверяются в маршруте удаления
  const cookieStore = await cookies();
  const viewer = await profileByDeviceToken(cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null);
  const isAdmin = viewer !== null && env.ADMIN_TAGS.includes(viewer.tag);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="display text-3xl leading-none tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('lead')}</p>
      </header>
      <PlayersList players={players} isAdmin={isAdmin} viewerId={viewer?.id ?? null} />
    </section>
  );
}
