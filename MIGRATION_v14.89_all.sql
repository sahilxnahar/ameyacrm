-- Ameya Heights CRM — migration for v14.89 (Ameya Tally phase 2: inventory & GST invoicing)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.89.
-- (Run MIGRATION_v14.88_all.sql first if you haven't — it adds the base Tally tables.)

CREATE TABLE IF NOT EXISTS "TallyStockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Nos',
    "hsn" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "openingQty" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "openingRate" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyStockItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyStockItem_name_key" ON "TallyStockItem"("name");

CREATE TABLE IF NOT EXISTS "TallyInventoryLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "rate" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL,
    CONSTRAINT "TallyInventoryLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TallyInventoryLine_voucherId_idx" ON "TallyInventoryLine"("voucherId");
CREATE INDEX IF NOT EXISTS "TallyInventoryLine_itemId_idx" ON "TallyInventoryLine"("itemId");

DO $$ BEGIN
  ALTER TABLE "TallyInventoryLine" ADD CONSTRAINT "TallyInventoryLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "TallyVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TallyInventoryLine" ADD CONSTRAINT "TallyInventoryLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TallyStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
