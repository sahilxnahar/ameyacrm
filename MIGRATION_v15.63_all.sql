-- Ameya Heights CRM — migration for v15.63 (Module #56: BBMP/BDA Plan Sanction & FAR)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.63.
-- Tracks as-built vs sanctioned FAR/FSI with an automatic Occupancy-Certificate risk flag.

CREATE TABLE IF NOT EXISTS "PlanSanction" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sanctionNo" TEXT, "authority" TEXT NOT NULL DEFAULT 'BBMP',
  "sanctionedFar" DECIMAL(6,3) NOT NULL, "builtFar" DECIMAL(6,3) NOT NULL DEFAULT 0, "sanctionedArea" DECIMAL(14,2),
  "builtArea" DECIMAL(14,2), "deviationPct" DECIMAL(6,3) NOT NULL DEFAULT 0, "ocApplied" BOOLEAN NOT NULL DEFAULT false,
  "ocReceived" BOOLEAN NOT NULL DEFAULT false, "ocNumber" TEXT, "sanctionedOn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanSanction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanSanction_projectId_idx" ON "PlanSanction"("projectId");

DO $$ BEGIN
  ALTER TABLE "PlanSanction" ADD CONSTRAINT "PlanSanction_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
