-- CreateEnum
CREATE TYPE "MarketMode" AS ENUM ('LIVE', 'OTC');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('BUY', 'SELL', 'WAIT');

-- CreateEnum
CREATE TYPE "JournalResult" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN', 'PENDING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pair" TEXT NOT NULL,
    "marketMode" "MarketMode" NOT NULL DEFAULT 'LIVE',
    "direction" "SignalType" NOT NULL,
    "entryPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "stake" DOUBLE PRECISION,
    "result" "JournalResult" NOT NULL DEFAULT 'PENDING',
    "profit" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "notes" TEXT,
    "emotion" TEXT,
    "mistakes" TEXT,
    "screenshotUrl" TEXT,
    "indicatorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "marketMode" "MarketMode" NOT NULL DEFAULT 'LIVE',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "pair" TEXT NOT NULL,
    "marketMode" "MarketMode" NOT NULL DEFAULT 'LIVE',
    "timeframe" TEXT NOT NULL,
    "targetCandleTime" TIMESTAMP(3) NOT NULL,
    "signal" "SignalType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" JSONB NOT NULL,
    "actualOutcome" "SignalType",
    "wasCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'desktop',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "journal_entries_userId_date_idx" ON "journal_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "journal_entries_userId_pair_idx" ON "journal_entries"("userId", "pair");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_userId_pair_marketMode_key" ON "watchlist_items"("userId", "pair", "marketMode");

-- CreateIndex
CREATE INDEX "signal_logs_pair_timeframe_createdAt_idx" ON "signal_logs"("pair", "timeframe", "createdAt");

-- CreateIndex
CREATE INDEX "signal_logs_userId_createdAt_idx" ON "signal_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_logs" ADD CONSTRAINT "signal_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
