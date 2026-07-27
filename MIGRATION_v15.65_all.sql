-- Ameya Heights CRM — migration for v15.65 (Module #61: 4D BIM & Timeline Sync)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.65.
-- Links a 3D model to construction phases; a demand-linked phase, when completed,
-- brings its buyer PaymentMilestone due so the dunning engine raises the demand.

CREATE TABLE IF NOT EXISTS "BimModel" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL, "urn" TEXT, "discipline" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1, "progressPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BimModel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BimModel_projectId_idx" ON "BimModel"("projectId");

CREATE TABLE IF NOT EXISTS "BimPhase" (
  "id" TEXT NOT NULL, "bimModelId" TEXT NOT NULL, "label" TEXT NOT NULL, "elementIds" TEXT,
  "plannedOn" TIMESTAMP(3), "actualOn" TIMESTAMP(3), "milestoneId" TEXT, "triggersDemand" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BimPhase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BimPhase_bimModelId_idx" ON "BimPhase"("bimModelId");
CREATE INDEX IF NOT EXISTS "BimPhase_milestoneId_idx" ON "BimPhase"("milestoneId");

DO $$ BEGIN ALTER TABLE "BimModel" ADD CONSTRAINT "BimModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "BimPhase" ADD CONSTRAINT "BimPhase_bimModelId_fkey" FOREIGN KEY ("bimModelId") REFERENCES "BimModel"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "BimPhase" ADD CONSTRAINT "BimPhase_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PaymentMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
