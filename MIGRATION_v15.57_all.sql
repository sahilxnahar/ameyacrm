-- Ameya Heights CRM — migration for v15.57 (IP & Trademark Registry, module #81)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.57.
--
-- A firm-wide / project-scoped register of brand marks. Renewal is computed as
-- registration + 10 years and a mark auto-flips to RENEWAL_DUE near the deadline
-- (daily worker). No external API — this is a self-contained legal register.

DO $$ BEGIN CREATE TYPE "TrademarkStatus" AS ENUM ('FILED','FORMALITIES_CHK','EXAMINATION','OBJECTED','OPPOSED','ACCEPTED_ADVERTISED','REGISTERED','ABANDONED','REFUSED','RENEWAL_DUE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Trademark" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "mark" TEXT NOT NULL,
  "applicationNo" TEXT,
  "niceClass" INTEGER NOT NULL DEFAULT 37,
  "status" "TrademarkStatus" NOT NULL DEFAULT 'FILED',
  "proprietor" TEXT NOT NULL,
  "filedOn" TIMESTAMP(3),
  "registeredOn" TIMESTAMP(3),
  "renewalDueOn" TIMESTAMP(3),
  "objectionText" TEXT,
  "deadlineOn" TIMESTAMP(3),
  "agentName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trademark_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Trademark_applicationNo_key" ON "Trademark"("applicationNo");
CREATE INDEX IF NOT EXISTS "Trademark_projectId_idx" ON "Trademark"("projectId");
CREATE INDEX IF NOT EXISTS "Trademark_status_idx" ON "Trademark"("status");
CREATE INDEX IF NOT EXISTS "Trademark_renewalDueOn_idx" ON "Trademark"("renewalDueOn");
CREATE INDEX IF NOT EXISTS "Trademark_deadlineOn_idx" ON "Trademark"("deadlineOn");

CREATE TABLE IF NOT EXISTS "TrademarkEvent" (
  "id" TEXT NOT NULL,
  "trademarkId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "note" TEXT,
  "occurredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrademarkEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrademarkEvent_trademarkId_idx" ON "TrademarkEvent"("trademarkId");

DO $$ BEGIN
  ALTER TABLE "Trademark" ADD CONSTRAINT "Trademark_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrademarkEvent" ADD CONSTRAINT "TrademarkEvent_trademarkId_fkey"
    FOREIGN KEY ("trademarkId") REFERENCES "Trademark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
