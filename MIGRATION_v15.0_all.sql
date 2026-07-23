-- Ameya Heights CRM — migration for v15.0 (Batch 7: Litigation docket + EC/Khata renewals)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.0.

CREATE TABLE IF NOT EXISTS "LitigationHearing" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT,
    "outcome" TEXT,
    "nextDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LitigationHearing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LitigationHearing_matterId_date_idx" ON "LitigationHearing"("matterId", "date");

DO $$ BEGIN
  ALTER TABLE "LitigationHearing" ADD CONSTRAINT "LitigationHearing_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "LitigationMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "TitleDocument" ADD COLUMN IF NOT EXISTS "expiresOn" TIMESTAMP(3);
ALTER TABLE "TitleDocument" ADD COLUMN IF NOT EXISTS "renewalNote" TEXT;
CREATE INDEX IF NOT EXISTS "TitleDocument_expiresOn_idx" ON "TitleDocument"("expiresOn");
