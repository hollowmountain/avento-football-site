# ADR-0001: Next.js 16 и Prisma 7 вместо Next.js 15 и классической Prisma

Статус: принято · Дата: 2026-08-12

## Контекст

ТЗ писалось под Next.js 15 и Prisma с Rust-движками (`binaryTargets`,
`node:22-alpine` с OpenSSL-грablями). На момент реализации стабильные
версии — Next.js 16.3 и Prisma 7.9: их и ставит `create-next-app`/`npm i`.

## Решение

Строим на актуальных мажорах:

- **Next.js 16**: тот же App Router; `middleware.ts` переименован в
  `proxy.ts` (deprecation в 16), всё остальное из ТЗ переносится 1:1.
- **Prisma 7**: rust-free архитектура — клиент генерируется в
  `src/generated/prisma`, соединение через driver adapter
  `@prisma/adapter-pg`, URL живёт в `prisma.config.ts`, а не в схеме.

## Последствия

- `node:22-alpine` работает без OpenSSL-обвязки (нет нативных движков) —
  Dockerfile соответствует ТЗ буквально.
- `binaryTargets` больше не нужен.
- Даунгрейд на старые мажоры потребовал бы пиновать устаревшие версии
  без выигрыша в надёжности.
