-- Ameya Heights CRM v10.0 — per-person active project.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeProjectId" TEXT;
