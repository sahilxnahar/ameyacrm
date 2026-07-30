-- v15.89 — Security remediation batch 2.
-- F-24: add expiry timestamps to public share/portal/pay tokens. All columns are
-- NULLABLE and additive: existing links (NULL expiry) keep working, newly issued
-- links carry an expiry and are rejected after it. Safe to run more than once.

ALTER TABLE "Customer"            ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "ChannelPartner"      ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "FloorPlan"           ADD COLUMN IF NOT EXISTS "shareTokenExpiresAt"  TIMESTAMP(3);
ALTER TABLE "VendorPortalAccess"  ADD COLUMN IF NOT EXISTS "tokenExpiresAt"       TIMESTAMP(3);
ALTER TABLE "PaymentRequest"      ADD COLUMN IF NOT EXISTS "tokenExpiresAt"       TIMESTAMP(3);
