-- Ameya Heights CRM — migration for v14.99 (Batch 7: Parking Matrix)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.99.

CREATE TABLE IF NOT EXISTS "ParkingSlot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "code" TEXT NOT NULL,
    "level" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Covered',
    "status" TEXT NOT NULL DEFAULT 'Available',
    "unitId" TEXT,
    "bookingId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParkingSlot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParkingSlot_code_key" ON "ParkingSlot"("code");
CREATE INDEX IF NOT EXISTS "ParkingSlot_projectId_idx" ON "ParkingSlot"("projectId");
CREATE INDEX IF NOT EXISTS "ParkingSlot_unitId_idx" ON "ParkingSlot"("unitId");
CREATE INDEX IF NOT EXISTS "ParkingSlot_status_idx" ON "ParkingSlot"("status");
