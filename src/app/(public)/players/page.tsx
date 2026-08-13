import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { PlayersList } from '@/modules/profile/presentation/players-list';

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

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="display text-3xl leading-none tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('lead')}</p>
      </header>
      <PlayersList players={players} />
    </section>
  );
}
