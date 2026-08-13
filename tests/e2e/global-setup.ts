import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { config as loadDotenv } from 'dotenv';

/** Миграции + чистая база перед прогоном e2e. */
export default async function globalSetup(): Promise<void> {
  loadDotenv();
  const url = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/kickoff_e2e';

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(
    'TRUNCATE "Game", "Participant", "ParticipantProfile", "UserProfile", "ProfileDevice", "RateLimitEvent", "AuditLog", "WeatherCache" CASCADE',
  );
  await client.end();
}
