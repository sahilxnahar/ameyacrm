-- Ameya Heights CRM — migration for v15.25 (App Exchange / connector directory)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.25.
--
-- Adds ConnectorInstall: one row per connector installed from the App Exchange.
-- The connector directory itself is code (no table). OAuth/native connectors keep
-- using IntegrationConnection for their tokens; this records the install + on/off.

CREATE TABLE IF NOT EXISTS "ConnectorInstall" (
  "id"            TEXT NOT NULL,
  "slug"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'INSTALLED',
  "config"        JSONB,
  "installCount"  INTEGER NOT NULL DEFAULT 1,
  "installedById" TEXT,
  "installedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectorInstall_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConnectorInstall_slug_key" ON "ConnectorInstall"("slug");
CREATE INDEX IF NOT EXISTS "ConnectorInstall_status_idx" ON "ConnectorInstall"("status");
