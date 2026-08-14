'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { apiFetch } from '@/shared/lib/api-client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { GAME_FORMATS } from '../schemas';
import type { GamesListData } from './api-types';
import { GameCard } from './game-card';

/**
 * Карта тянет за собой Leaflet, и на сервере ей делать нечего:
 * грузим её отдельным куском кода и только когда включили вид «карта».
 */
const GamesMap = dynamic(() => import('./games-map').then((m) => m.GamesMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] min-h-80 w-full rounded-xl" />,
});

const ANY = '__any__';

type FeedView = 'list' | 'map';

interface FeedFilters {
  city: string;
  format: string;
  skillLevel: string;
  hasFreeSlots: boolean;
  sort: 'soonest' | 'few_slots';
}

const DEFAULT_FILTERS: FeedFilters = {
  city: '',
  format: ANY,
  skillLevel: ANY,
  hasFreeSlots: false,
  sort: 'soonest',
};

function buildQuery(filters: FeedFilters, cursor: string | null): string {
  const params = new URLSearchParams();
  if (filters.city.trim()) params.set('city', filters.city.trim());
  if (filters.format !== ANY) params.set('format', filters.format);
  if (filters.skillLevel !== ANY) params.set('skillLevel', filters.skillLevel);
  if (filters.hasFreeSlots) params.set('hasFreeSlots', 'true');
  params.set('sort', filters.sort);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

/** Публичная лента: фильтры, сортировка, cursor-пагинация («Показать ещё»). */
export function FeedClient({ initialData }: { initialData: GamesListData }) {
  const t = useTranslations('feed');
  const tHeader = useTranslations('header');
  const tFormats = useTranslations('formats');

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [cityDraft, setCityDraft] = useState('');
  const [view, setView] = useState<FeedView>('list');

  const isDefault =
    filters.city === '' &&
    filters.format === ANY &&
    filters.skillLevel === ANY &&
    !filters.hasFreeSlots &&
    filters.sort === 'soonest';

  const query = useInfiniteQuery({
    queryKey: ['games', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<GamesListData>(`/api/games?${buildQuery(filters, pageParam)}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...(isDefault
      ? { initialData: { pages: [initialData], pageParams: [null as string | null] } }
      : {}),
  });

  // Ссылка на список должна быть стабильной: по ней карта решает,
  // пересобирать ли маркеры и подгонять ли масштаб под точки
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const applyCity = () => setFilters((f) => ({ ...f, city: cityDraft }));

  const loadMore = query.hasNextPage ? (
    <Button
      variant="outline"
      className="display w-full tracking-wide"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {t('loadMore')}
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="display text-3xl">{t('title')}</h1>
        {/* Равнозначные кнопки: один шрифт и кегль, различие — заливкой */}
        <div className="flex gap-1" role="group" aria-label={t('view.label')}>
          {(['list', 'map'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={view === mode ? 'default' : 'outline'}
              aria-pressed={view === mode}
              className="display tracking-wide"
              onClick={() => setView(mode)}
            >
              {t(`view.${mode}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Фильтры */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="search">
        <div className="space-y-1">
          <Label htmlFor="feed-city" className="eyebrow text-muted-foreground">
            {t('filters.city')}
          </Label>
          <Input
            id="feed-city"
            placeholder={t('filters.cityPlaceholder')}
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            onBlur={applyCity}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCity();
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="eyebrow text-muted-foreground">{t('filters.format')}</Label>
          <Select
            value={filters.format}
            onValueChange={(format) => setFilters((f) => ({ ...f, format }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('filters.anyFormat')}</SelectItem>
              {GAME_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {tFormats(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="eyebrow text-muted-foreground">{t('filters.sort')}</Label>
          <Select
            value={filters.sort}
            onValueChange={(sort) =>
              setFilters((f) => ({ ...f, sort: sort as FeedFilters['sort'] }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">{t('filters.soonest')}</SelectItem>
              <SelectItem value="few_slots">{t('filters.fewSlots')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={filters.hasFreeSlots}
            onChange={(e) => setFilters((f) => ({ ...f, hasFreeSlots: e.target.checked }))}
          />
          {t('filters.onlyFree')}
        </label>
      </div>

      {/* Список или карта — данные одни и те же, меняется подача */}
      {query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : view === 'map' ? (
        <div className="space-y-3">
          <GamesMap games={items} />
          {loadMore}
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground space-y-4 py-16 text-center">
          <p>{t('empty')}</p>
          <Button asChild>
            <Link href="/games/new">{tHeader('create')}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite">
          {items.map((game) => (
            <GameCard key={game.code} game={game} />
          ))}
          {loadMore}
        </div>
      )}
    </div>
  );
}
