-- CreateEnum
CREATE TYPE "GameVisibility" AS ENUM ('PUBLIC', 'PRIVATE_LINK', 'PRIVATE_PASSWORD');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "inviteKey" TEXT,
ADD COLUMN     "joinKeyHash" TEXT,
ADD COLUMN     "visibility" "GameVisibility" NOT NULL DEFAULT 'PUBLIC';
