-- MIGRATION v14.24 — Vendor Portal (31-plan #26). Adds 1 table for the
-- token→vendor portal link. Idempotent. Or use the in-app "Fix it now" button.

CREATE TABLE IF NOT EXISTS "VendorPortalAccess" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VendorPortalAccess_vendorId_key" ON "VendorPortalAccess"("vendorId");
CREATE UNIQUE INDEX IF NOT EXISTS "VendorPortalAccess_token_key" ON "VendorPortalAccess"("token");
CREATE INDEX IF NOT EXISTS "VendorPortalAccess_token_idx" ON "VendorPortalAccess"("token");
