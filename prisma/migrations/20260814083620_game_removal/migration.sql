-- AlterEnum
ALTER TYPE "GameStatus" ADD VALUE 'REMOVED_BY_ADMIN';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "removalNote" TEXT,
ADD COLUMN     "removalReason" TEXT;
