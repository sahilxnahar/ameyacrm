-- Ameya Heights CRM — migration for v15.56 (Payment Demand & Dunning, module #4)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.56.
--
-- Turns due/overdue PaymentMilestone rows into dispatched WhatsApp + email
-- reminders (DemandNotice). No money moves here — the money spine stays
-- PaymentMilestone → Voucher. Generation is idempotent per milestone per kind.

DO $$ BEGIN CREATE TYPE "DemandKind" AS ENUM ('UPCOMING','OVERDUE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DemandStatus" AS ENUM ('PENDING','SENT','PAID','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DemandNotice" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "kind" "DemandKind" NOT NULL DEFAULT 'OVERDUE',
  "status" "DemandStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "label" TEXT NOT NULL,
  "channel" TEXT,
  "sentVia" TEXT,
  "sentAt" TIMESTAMP(3),
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemandNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DemandNotice_number_key" ON "DemandNotice"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "DemandNotice_milestoneId_kind_key" ON "DemandNotice"("milestoneId","kind");
CREATE INDEX IF NOT EXISTS "DemandNotice_bookingId_idx" ON "DemandNotice"("bookingId");
CREATE INDEX IF NOT EXISTS "DemandNotice_status_idx" ON "DemandNotice"("status");
CREATE INDEX IF NOT EXISTS "DemandNotice_dueDate_idx" ON "DemandNotice"("dueDate");

-- Foreign keys (added only if missing)
DO $$ BEGIN
  ALTER TABLE "DemandNotice" ADD CONSTRAINT "DemandNotice_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "DemandNotice" ADD CONSTRAINT "DemandNotice_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "PaymentMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
