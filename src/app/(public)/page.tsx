import { cookies } from 'next/headers';
import { getGameDeps } from '@/modules/game/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToSummaryDto } from '@/modules/game/presentation/dto';
import { FeedClient } from '@/modules/game/presentation/feed-client';
import { profileByDeviceToken } from '@/modules/profile/server';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/** Публичная лента ближайших игр: SSR первой страницы + клиентские фильтры. */
export default async function FeedPage() {
  lazySweep();

  const deps = getGameDeps();
  const page = await deps.games.list({ dateFrom: new Date() }, 'soonest', null, 20);

  // Владельцу сайта в ленте доступно снятие игр; проверка прав всё равно
  // повторяется на сервере в самом маршруте снятия
  const cookieStore = await cookies();
  const viewer = await profileByDeviceToken(cookieStore.get(PARTICIPANT_COOKIE)?.value ?? null);
  const isAdmin = viewer !== null && env.ADMIN_TAGS.includes(viewer.tag);

  return (
    <FeedClient
      isAdmin={isAdmin}
      initialData={{
        items: page.items.map(({ game, activeMainCount }) =>
          gameToSummaryDto(game, activeMainCount, activeMainCount),
        ),
        nextCursor: page.nextCursor,
      }}
    />
  );
}
