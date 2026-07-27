-- Ameya Heights CRM — migration for v15.69 (Module #67: BOCW Welfare Log)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.69.
-- Statutory-audit evidence for drinking water, medical, creche and sanitation.

CREATE TABLE IF NOT EXISTS "WelfareLog" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "category" TEXT NOT NULL, "headcount" INTEGER,
  "note" TEXT, "photoUrl" TEXT, "loggedById" TEXT, "loggedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WelfareLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WelfareLog_projectId_idx" ON "WelfareLog"("projectId");
CREATE INDEX IF NOT EXISTS "WelfareLog_category_idx" ON "WelfareLog"("category");

DO $$ BEGIN
  ALTER TABLE "WelfareLog" ADD CONSTRAINT "WelfareLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
