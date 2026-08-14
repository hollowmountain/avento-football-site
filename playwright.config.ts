import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

const E2E_PORT = 3100;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/kickoff_e2e';

/**
 * E2E гоняются на продакшен-билде (`npm run build` перед запуском!) —
 * так ловятся standalone/OG-проблемы, которых нет в dev-режиме.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'npm run start:e2e',
    port: E2E_PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      TOKEN_PEPPER: 'e2e-token-pepper-0123456789',
      IP_HASH_SALT: 'e2e-ip-salt-0123456789abcd',
      CRON_SECRET: 'e2e-cron-secret-0123456789',
      APP_URL: `http://localhost:${E2E_PORT}`,
      // Лимиты подняты: сценарии идут с одного IP и делают много записей
      // подряд (протокол матч-дня — это десяток запросов за полминуты),
      // а сам rate limiting покрыт integration-тестами
      RATE_CREATE_GAME_PER_10MIN: '100',
      RATE_CREATE_GAME_PER_DAY: '100',
      RATE_CREATE_GAME_IP_PER_DAY: '100',
      RATE_GLOBAL_WRITES_PER_MIN: '500',
      // Без сети: координаты считает детерминированная заглушка
      GEOCODER: 'stub',
    },
  },
});
