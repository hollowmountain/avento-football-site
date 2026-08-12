import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CreateGameForm } from '@/modules/game/presentation/create-game-form';
import { env } from '@/shared/lib/env';
import { issueFormToken } from '@/shared/security/anti-abuse';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('createForm');
  return { title: t('title') };
}

export default function NewGamePage() {
  // Time-trap: подписанный момент рендера формы (анти-бот, см. ТЗ §3)
  const formToken = issueFormToken(env.TOKEN_PEPPER, new Date());

  return (
    <CreateGameForm
      formToken={formToken}
      defaults={{
        city: env.DEFAULT_CITY,
        currency: env.DEFAULT_CURRENCY,
        timezone: env.DEFAULT_TIMEZONE,
      }}
    />
  );
}
