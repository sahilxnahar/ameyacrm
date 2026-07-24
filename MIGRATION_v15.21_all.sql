-- Ameya Heights CRM — migration for v15.21 (public API webhooks)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.21.
--
-- Adds the Webhook table. The CRM POSTs a signed JSON payload to a webhook's URL
-- whenever a subscribed event happens (lead.created, lead.stage_changed, …) —
-- this is what Zapier, Make and custom systems subscribe to. The public REST API
-- and API tokens already exist; this only adds outbound webhooks.

CREATE TABLE IF NOT EXISTS "Webhook" (
  "id"             TEXT NOT NULL,
  "url"            TEXT NOT NULL,
  "events"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "secret"         TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "description"    TEXT,
  "source"         TEXT NOT NULL DEFAULT 'manual',
  "createdById"    TEXT,
  "lastStatus"     INTEGER,
  "lastDeliveryAt" TIMESTAMP(3),
  "lastError"      TEXT,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Webhook_isActive_idx" ON "Webhook"("isActive");
