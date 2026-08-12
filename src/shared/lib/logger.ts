import pino from 'pino';
import { env } from './env';

/**
 * Структурированные JSON-логи. PII (имена, IP, токены) не логируем.
 * В dev — человекочитаемый вывод через pino-pretty.
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: undefined, // без pid/hostname — Railway добавляет своё
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});

export function withRequestId(requestId: string | null | undefined) {
  return requestId ? logger.child({ requestId }) : logger;
}
