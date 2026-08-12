import { EventEmitter } from 'node:events';
import type Redis from 'ioredis';
import { getRedis } from '@/shared/lib/redis';
import { logger } from '@/shared/lib/logger';
import type { EventBus, GameEvent } from '../application/ports';

/**
 * Шина live-событий для SSE.
 *
 * По умолчанию — in-process EventEmitter: на Railway один инстанс, события
 * нужны только подписчикам процесса, принявшего мутацию (docs/ADR/0003).
 * При заданном REDIS_URL публикация идёт через Redis pub/sub — это включает
 * горизонтальное масштабирование (все реплики видят все события).
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

const CHANNEL_PREFIX = 'kickoff:game:';

class RedisEventBus implements EventBus {
  private readonly emitter = new EventEmitter();
  private readonly subscriber: Redis;

  constructor(private readonly publisher: Redis) {
    this.emitter.setMaxListeners(0);
    this.subscriber = publisher.duplicate();
    this.subscriber.on('error', (error) => {
      logger.warn({ err: error.message }, 'redis event bus: ошибка подписчика');
    });
    void this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const event = JSON.parse(message) as GameEvent;
        this.emitter.emit(channel.slice(CHANNEL_PREFIX.length), event);
      } catch {
        // повреждённое сообщение игнорируем
      }
    });
  }

  publish(gameCode: string, event: GameEvent): void {
    this.publisher
      .publish(`${CHANNEL_PREFIX}${gameCode}`, JSON.stringify(event))
      .catch((error: Error) => {
        logger.warn({ err: error.message }, 'redis event bus: publish не удался');
        // Fallback: доставим хотя бы подписчикам этого процесса
        this.emitter.emit(gameCode, event);
      });
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
    const redis = getRedis();
    globalForEvents.kickoffEventBus = redis ? new RedisEventBus(redis) : new InProcessEventBus();
  }
  return globalForEvents.kickoffEventBus;
}
