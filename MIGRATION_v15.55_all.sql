-- Ameya Heights CRM — migration for v15.55 (Core Integration Layer #50)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.55.
--
-- The durable async event bus + unified IoT hub + buyer 70/30 escrow split.
-- Every third-party webhook (Razorpay/WhatsApp/IoT) lands in WebhookEvent and is
-- processed out-of-band by /api/cron/worker, so the CRM UI never blocks.

DO $$ BEGIN CREATE TYPE "WebhookStatus" AS ENUM ('PENDING','PROCESSING','DONE','FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EscrowAccountType" AS ENUM ('RERA_70','GENERAL_30'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING', "retryCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider","externalId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status","createdAt");

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT NOT NULL, "projectId" TEXT, "name" TEXT NOT NULL, "kind" TEXT NOT NULL, "serialNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_serialNumber_key" ON "Asset"("serialNumber");
CREATE INDEX IF NOT EXISTS "Asset_projectId_idx" ON "Asset"("projectId");

CREATE TABLE IF NOT EXISTS "IotReading" (
  "id" TEXT NOT NULL, "assetId" TEXT NOT NULL, "metric" TEXT NOT NULL, "value" DECIMAL(14,4) NOT NULL,
  "rawPayload" JSONB, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IotReading_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IotReading_assetId_metric_recordedAt_idx" ON "IotReading"("assetId","metric","recordedAt");

CREATE TABLE IF NOT EXISTS "BookingEscrowSplit" (
  "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "webhookEventId" TEXT, "voucherId" TEXT,
  "accountType" "EscrowAccountType" NOT NULL, "amount" DECIMAL(16,2) NOT NULL, "utrNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BookingEscrowSplit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BookingEscrowSplit_bookingId_idx" ON "BookingEscrowSplit"("bookingId");
