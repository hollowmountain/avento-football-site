'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsLiteral, Map as LeafletMap, Marker } from 'leaflet';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import type { GameSummaryDto } from './dto';
import { GameCard } from './game-card';

/**
 * Игры на карте города. Leaflet подключён из npm и собирается в бандл:
 * внешних SDK и ключей нет, наружу уходят только тайлы OSM (их домен
 * добавлен в img-src политики CSP — см. src/proxy.ts).
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">OpenStreetMap</a>';
/** Пустая карта где-то должна открыться: центр страны по умолчанию. */
const FALLBACK_CENTER: [number, number] = [55.7558, 37.6173];
const FALLBACK_ZOOM = 9;
/** Одна игра не должна утаскивать карту в максимальное приближение. */
const FIT_MAX_ZOOM = 14;

/** Маркер рисуем сами: картинок Leaflet нет, а янтарь берётся из темы. */
const PIN_HTML =
  '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">' +
  '<path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z" ' +
  'fill="var(--primary)" stroke="var(--background)" stroke-width="1.5" />' +
  '<circle cx="12" cy="12" r="4.5" fill="var(--primary-foreground)" />' +
  '</svg>';

export function GamesMap({ games }: { games: GameSummaryDto[] }) {
  const t = useTranslations('feed.map');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Карта создаётся асинхронно (Leaflet трогает window и грузится только
  // в браузере), поэтому в ref живёт промис, а не готовый объект
  const mapRef = useRef<Promise<MapHandle | null> | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let cancelled = false;
    const pending = import('leaflet').then((L): MapHandle | null => {
      // Размонтировались, пока грузился Leaflet: карту не создаём вовсе
      if (cancelled) return null;
      const map = L.map(container, {
        // Колесо мыши оставляем странице: карта живёт внутри длинной ленты
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView(FALLBACK_CENTER, FALLBACK_ZOOM);
      // Leaflet по умолчанию подписывает себя вместе с украинским флагом.
      // Ссылку на библиотеку оставляем, флаг убираем: сайту, который
      // работает из России, политическая символика в подписи ни к чему.
      map.attributionControl.setPrefix(
        '<a href="https://leafletjs.com" target="_blank" rel="noreferrer noopener">Leaflet</a>',
      );
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      return { L, map };
    });
    mapRef.current = pending;

    return () => {
      cancelled = true;
      void pending.then((handle) => handle?.map.remove());
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const pending = mapRef.current;
    if (pending === null) return;

    let alive = true;
    void pending.then((handle) => {
      if (!alive || handle === null) return;
      const { L, map } = handle;

      for (const marker of markersRef.current) marker.remove();
      const icon = L.divIcon({
        className: 'game-pin',
        html: PIN_HTML,
        iconSize: [24, 32],
        iconAnchor: [12, 32],
      });
      const markers: Marker[] = [];
      const bounds: LatLngBoundsLiteral = [];
      for (const game of games) {
        const marker = L.marker([game.latitude, game.longitude], { icon, title: game.title })
          .addTo(map)
          .on('click', () => setSelectedCode(game.code));
        markers.push(marker);
        bounds.push([game.latitude, game.longitude]);
      }
      markersRef.current = markers;
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: FIT_MAX_ZOOM });
      }
    });

    return () => {
      alive = false;
    };
  }, [games]);

  const selected = games.find((game) => game.code === selectedCode) ?? null;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="application"
        aria-label={t('label')}
        // isolate: у контролов Leaflet свой z-index, и без отдельного слоя
        // они перекрывают карточку выбранной игры
        className="border-border isolate h-[60vh] min-h-80 w-full overflow-hidden rounded-xl border"
      />

      {games.length === 0 ? (
        <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm">
          {t('empty')}
        </p>
      ) : null}

      {selected !== null ? (
        <div className="absolute inset-x-2 bottom-2 z-10 flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="icon"
            className="bg-card size-8"
            aria-label={t('close')}
            onClick={() => setSelectedCode(null)}
          >
            <X className="size-4" aria-hidden />
          </Button>
          <div className="w-full">
            <GameCard game={selected} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface MapHandle {
  L: typeof import('leaflet');
  map: LeafletMap;
}
