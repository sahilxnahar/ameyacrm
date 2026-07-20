-- Ameya Heights CRM v10.2 — cash book and vouchers.
DO $$ BEGIN CREATE TYPE "VoucherKind"   AS ENUM ('CASH_RECEIVED','CASH_PAID','MATERIAL_RECEIVED','MATERIAL_ISSUED','BANK_RECEIVED','BANK_PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT','POSTED','CANCELLED');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PayMode"       AS ENUM ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Voucher" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "kind" "VoucherKind" NOT NULL,
  "status" "VoucherStatus" NOT NULL DEFAULT 'POSTED',
  "voucherDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "partyName" TEXT NOT NULL,
  "partyPhone" TEXT,
  "vendorId" TEXT, "customerId" TEXT, "leadId" TEXT,
  "projectId" TEXT, "bookingId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "mode" "PayMode" NOT NULL DEFAULT 'CASH',
  "reference" TEXT, "narration" TEXT,
  "materialName" TEXT, "quantity" DECIMAL(12,3), "unit" TEXT, "rate" DECIMAL(12,2),
  "gstRate" DECIMAL(5,2), "gstAmount" DECIMAL(14,2),
  "attachmentId" TEXT, "createdById" TEXT, "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Voucher_number_key"            ON "Voucher"("number");
CREATE INDEX IF NOT EXISTS "Voucher_kind_voucherDate_idx"         ON "Voucher"("kind","voucherDate");
CREATE INDEX IF NOT EXISTS "Voucher_projectId_voucherDate_idx"    ON "Voucher"("projectId","voucherDate");
CREATE INDEX IF NOT EXISTS "Voucher_status_idx"                   ON "Voucher"("status");
CREATE INDEX IF NOT EXISTS "Voucher_partyName_idx"                ON "Voucher"("partyName");
