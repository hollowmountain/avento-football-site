-- CreateEnum
CREATE TYPE "MatchDayStatus" AS ENUM ('LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "DayMatchStatus" AS ENUM ('LIVE', 'FINISHED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "managerProfileId" TEXT;

-- CreateTable
CREATE TABLE "MatchDay" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "MatchDayStatus" NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rotation" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDayTeam" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "MatchDayTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDayMember" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "MatchDayMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayMatch" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "DayMatchStatus" NOT NULL DEFAULT 'LIVE',
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "timerRunning" BOOLEAN NOT NULL DEFAULT true,
    "accumulatedMs" INTEGER NOT NULL DEFAULT 0,
    "timerStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DayMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayGoal" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "scorerParticipantId" TEXT,
    "assistParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchDay_gameId_key" ON "MatchDay"("gameId");

-- CreateIndex
CREATE INDEX "MatchDayTeam_dayId_order_idx" ON "MatchDayTeam"("dayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayMember_participantId_key" ON "MatchDayMember"("participantId");

-- CreateIndex
CREATE INDEX "MatchDayMember_dayId_idx" ON "MatchDayMember"("dayId");

-- CreateIndex
CREATE INDEX "MatchDayMember_teamId_idx" ON "MatchDayMember"("teamId");

-- CreateIndex
CREATE INDEX "DayMatch_dayId_order_idx" ON "DayMatch"("dayId", "order");

-- CreateIndex
CREATE INDEX "DayGoal_matchId_createdAt_idx" ON "DayGoal"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "DayGoal_scorerParticipantId_idx" ON "DayGoal"("scorerParticipantId");

-- CreateIndex
CREATE INDEX "DayGoal_assistParticipantId_idx" ON "DayGoal"("assistParticipantId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_managerProfileId_fkey" FOREIGN KEY ("managerProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDay" ADD CONSTRAINT "MatchDay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayTeam" ADD CONSTRAINT "MatchDayTeam_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayMember" ADD CONSTRAINT "MatchDayMember_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayMember" ADD CONSTRAINT "MatchDayMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayMember" ADD CONSTRAINT "MatchDayMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MatchDayTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayMatch" ADD CONSTRAINT "DayMatch_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayMatch" ADD CONSTRAINT "DayMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "MatchDayTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayMatch" ADD CONSTRAINT "DayMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "MatchDayTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayGoal" ADD CONSTRAINT "DayGoal_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DayMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayGoal" ADD CONSTRAINT "DayGoal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MatchDayTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayGoal" ADD CONSTRAINT "DayGoal_scorerParticipantId_fkey" FOREIGN KEY ("scorerParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayGoal" ADD CONSTRAINT "DayGoal_assistParticipantId_fkey" FOREIGN KEY ("assistParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
