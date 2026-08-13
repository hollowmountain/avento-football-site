-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "profileId" TEXT;

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" "Gender",
    "loginCodeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileDevice" (
    "tokenHash" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileDevice_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_tag_key" ON "UserProfile"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_loginCodeHash_key" ON "UserProfile"("loginCodeHash");

-- CreateIndex
CREATE INDEX "ProfileDevice_profileId_idx" ON "ProfileDevice"("profileId");

-- CreateIndex
CREATE INDEX "Participant_profileId_idx" ON "Participant"("profileId");

-- AddForeignKey
ALTER TABLE "ProfileDevice" ADD CONSTRAINT "ProfileDevice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
