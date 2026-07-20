-- Ameya Heights CRM v8.2 — portal ingestion, floor-plan options, wider custom fields.
ALTER TABLE "Unit"      ADD COLUMN IF NOT EXISTS "customFields" JSONB;
ALTER TABLE "Booking"   ADD COLUMN IF NOT EXISTS "customFields" JSONB;
ALTER TABLE "Customer"  ADD COLUMN IF NOT EXISTS "customFields" JSONB;

ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "kind"        TEXT NOT NULL DEFAULT 'FLOOR';
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "shareToken"  TEXT;
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "isPublic"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "description" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "FloorPlan_shareToken_key" ON "FloorPlan"("shareToken");
-- Ameya Heights CRM v9.0 — two-way email, sequences, SSO. Safe to re-run.

DO $$ BEGIN CREATE TYPE "MailDirection"    AS ENUM ('INBOUND','OUTBOUND');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SequenceStatus"   AS ENUM ('ACTIVE','PAUSED','ARCHIVED');               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EnrollmentStatus" AS ENUM ('RUNNING','REPLIED','FINISHED','STOPPED');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailThreadMessage" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "threadKey" TEXT NOT NULL,
  "direction" "MailDirection" NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddresses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT, "bodyText" TEXT, "snippet" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT, "customerId" TEXT, "userId" TEXT,
  "trackToken" TEXT, "openedAt" TIMESTAMP(3),
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "enrollmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailThreadMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_externalId_key" ON "MailThreadMessage"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_trackToken_key" ON "MailThreadMessage"("trackToken");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_leadId_sentAt_idx"     ON "MailThreadMessage"("leadId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_customerId_sentAt_idx" ON "MailThreadMessage"("customerId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_threadKey_idx"         ON "MailThreadMessage"("threadKey");

CREATE TABLE IF NOT EXISTS "EmailSequence" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "SequenceStatus" NOT NULL DEFAULT 'PAUSED',
  "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
  "stopOnStage" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SequenceStep" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "dayOffset" INTEGER NOT NULL DEFAULT 0,
  "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceStep_sequenceId_ordinal_key" ON "SequenceStep"("sequenceId","ordinal");

CREATE TABLE IF NOT EXISTS "SequenceEnrollment" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'RUNNING',
  "stepsSent" INTEGER NOT NULL DEFAULT 0,
  "nextStepAt" TIMESTAMP(3), "enrolledById" TEXT,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), "endReason" TEXT,
  CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceEnrollment_sequenceId_leadId_key" ON "SequenceEnrollment"("sequenceId","leadId");
CREATE INDEX IF NOT EXISTS "SequenceEnrollment_status_nextStepAt_idx" ON "SequenceEnrollment"("status","nextStepAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceStep_sequenceId_fkey') THEN
    ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceEnrollment_sequenceId_fkey') THEN
    ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
