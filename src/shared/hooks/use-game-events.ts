'use client';

import { useEffect, useRef } from 'react';

const EVENT_TYPES = [
  'participants_changed',
  'game_updated',
  'teams_shuffled',
  'game_cancelled',
] as const;

/**
 * Подписка на SSE игры. Notify-then-fetch: любое событие вызывает onEvent
 * (инвалидацию TanStack Query), реконнект EventSource делает сам.
 */
export function useGameEvents(gameCode: string, onEvent: () => void): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const source = new EventSource(`/api/games/${gameCode}/stream`);
    const handler = () => onEventRef.current();
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, handler);
    }
    return () => source.close();
  }, [gameCode]);
}
