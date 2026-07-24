-- Ameya Heights CRM — migration for v15.23 (DPDPA consent trail)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.23.
--
-- Adds the ConsentRecord table: an append-only trail of consent given/withdrawn
-- per purpose (marketing, WhatsApp, calls, data processing) for each data
-- principal. Data-request, erasure and retention features already exist; this
-- adds the consent half of DPDPA and backs the retention-sweep job.

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id"           TEXT NOT NULL,
  "subjectEmail" TEXT,
  "subjectPhone" TEXT,
  "subjectName"  TEXT,
  "purpose"      TEXT NOT NULL,
  "status"       TEXT NOT NULL,
  "source"       TEXT,
  "leadId"       TEXT,
  "customerId"   TEXT,
  "note"         TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsentRecord_subjectEmail_idx" ON "ConsentRecord"("subjectEmail");
CREATE INDEX IF NOT EXISTS "ConsentRecord_subjectPhone_idx" ON "ConsentRecord"("subjectPhone");
CREATE INDEX IF NOT EXISTS "ConsentRecord_purpose_status_idx" ON "ConsentRecord"("purpose", "status");
