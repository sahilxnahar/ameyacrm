-- Ameya Heights CRM v8.2 — portal ingestion, floor-plan options, wider custom fields.
ALTER TABLE "Unit"      ADD COLUMN IF NOT EXISTS "customFields" JSONB;
ALTER TABLE "Booking"   ADD COLUMN IF NOT EXISTS "customFields" JSONB;
ALTER TABLE "Customer"  ADD COLUMN IF NOT EXISTS "customFields" JSONB;

ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "kind"        TEXT NOT NULL DEFAULT 'FLOOR';
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "shareToken"  TEXT;
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "isPublic"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FloorPlan" ADD COLUMN IF NOT EXISTS "description" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "FloorPlan_shareToken_key" ON "FloorPlan"("shareToken");
