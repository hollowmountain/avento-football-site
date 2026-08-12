-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('OPEN', 'FULL', 'CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED');

-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('FIVE_A_SIDE', 'SIX_A_SIDE', 'SEVEN_A_SIDE', 'EIGHT_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('ANY', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'ANY');

-- CreateEnum
CREATE TYPE "Attendance" AS ENUM ('CONFIRMED', 'MAYBE');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('MAIN', 'WAITLIST');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'OPEN',
    "format" "GameFormat" NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "pricePerPitch" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "cancelDeadline" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "city" TEXT NOT NULL,
    "hostTokenHash" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "createdIpHash" TEXT NOT NULL,
    "teamsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "attendance" "Attendance" NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "waitlistOrder" INTEGER,
    "tokenHash" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "wasLateCancel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantProfile" (
    "tokenHash" TEXT NOT NULL,
    "gamesJoined" INTEGER NOT NULL DEFAULT 0,
    "gamesAttended" INTEGER NOT NULL DEFAULT 0,
    "lateCancels" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantProfile_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");

-- CreateIndex
CREATE INDEX "Game_startsAt_status_idx" ON "Game"("startsAt", "status");

-- CreateIndex
CREATE INDEX "Game_city_startsAt_idx" ON "Game"("city", "startsAt");

-- CreateIndex
CREATE INDEX "Game_hostTokenHash_startsAt_idx" ON "Game"("hostTokenHash", "startsAt");

-- CreateIndex
CREATE INDEX "Participant_gameId_role_waitlistOrder_idx" ON "Participant"("gameId", "role", "waitlistOrder");

-- CreateIndex
CREATE INDEX "Participant_tokenHash_idx" ON "Participant"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_gameId_nickname_key" ON "Participant"("gameId", "nickname");

-- CreateIndex
CREATE INDEX "RateLimitEvent_key_createdAt_idx" ON "RateLimitEvent"("key", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_gameId_createdAt_idx" ON "AuditLog"("gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
