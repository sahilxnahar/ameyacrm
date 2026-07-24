-- Ameya Heights CRM — migration for v14.87 (Batch 4: Channel Partner portal)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.87.

ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "portalToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelPartner_portalToken_key" ON "ChannelPartner"("portalToken");
