import { config } from 'dotenv';

config();

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL не задан — интеграционные тесты требуют тестовую БД');
}
// Все импорты '@/shared/lib/db' в тестах должны смотреть в тестовую БД
process.env.DATABASE_URL = testUrl;
