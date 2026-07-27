-- Ameya Heights CRM — migration for v15.27 (App Packages / extensibility)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.27.
--
-- Adds AppPackageInstall: one row per installed package (a bundle of automations,
-- custom fields, saved views and connectors). Stores the manifest so a package —
-- including one a user imported as JSON — can be removed cleanly.

CREATE TABLE IF NOT EXISTS "AppPackageInstall" (
  "id"            TEXT NOT NULL,
  "packageId"     TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'catalogue',
  "manifest"      JSONB,
  "installedById" TEXT,
  "installedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppPackageInstall_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppPackageInstall_packageId_key" ON "AppPackageInstall"("packageId");
