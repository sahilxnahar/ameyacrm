-- Ameya Heights CRM v9.5 — rate limiting.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_bucket_windowStart_key" ON "RateLimit"("bucket","windowStart");
CREATE INDEX IF NOT EXISTS "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
