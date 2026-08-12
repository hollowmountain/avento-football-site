import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/** Один раз на прогон: применить миграции к тестовой БД. */
export default function globalSetup(): void {
  config();
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL не задан — интеграционные тесты требуют тестовую БД');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
