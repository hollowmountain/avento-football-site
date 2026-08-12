-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "creatorTokenHash" TEXT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "skillLevel" "SkillLevel" NOT NULL DEFAULT 'ANY';

-- CreateIndex
CREATE INDEX "Game_creatorTokenHash_startsAt_idx" ON "Game"("creatorTokenHash", "startsAt");
