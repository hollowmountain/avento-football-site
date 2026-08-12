import { EventEmitter } from 'node:events';
import type { EventBus, GameEvent } from '../application/ports';

/**
 * In-process шина событий для SSE. Достаточна для одного инстанса
 * (Railway). При горизонтальном масштабировании подключается
 * Redis pub/sub адаптер с тем же портом — см. docs/ADR/0003.
 */
class InProcessEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Подписчик на каждую открытую страницу игры — лимит не нужен
    this.emitter.setMaxListeners(0);
  }

  publish(gameCode: string, event: GameEvent): void {
    this.emitter.emit(gameCode, event);
  }

  subscribe(gameCode: string, listener: (event: GameEvent) => void): () => void {
    this.emitter.on(gameCode, listener);
    return () => this.emitter.off(gameCode, listener);
  }
}

// Singleton, переживающий hot-reload в dev (иначе SSE-подписчики потеряют события).
const globalForEvents = globalThis as unknown as { kickoffEventBus?: EventBus };

export function getEventBus(): EventBus {
  if (!globalForEvents.kickoffEventBus) {
    globalForEvents.kickoffEventBus = new InProcessEventBus();
  }
  return globalForEvents.kickoffEventBus;
}
