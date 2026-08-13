import { prisma } from '@/shared/lib/db';
import { env } from '@/shared/lib/env';
import { createTokenService } from '@/shared/security/tokens';
import type { ProfileDeps } from './application/use-cases';
import { PrismaProfileRepository } from './infrastructure/prisma-profile-repository';

/** Composition root модуля profile. */
const globalForDeps = globalThis as unknown as { kickoffProfileDeps?: ProfileDeps };

export function getProfileDeps(): ProfileDeps {
  if (!globalForDeps.kickoffProfileDeps) {
    globalForDeps.kickoffProfileDeps = {
      profiles: new PrismaProfileRepository(prisma),
      tokens: createTokenService(env.TOKEN_PEPPER),
    };
  }
  return globalForDeps.kickoffProfileDeps;
}
