-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "creatorProfileId" TEXT,
ADD COLUMN     "teamCount" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "durationMinutes" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "countryCode" TEXT;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
