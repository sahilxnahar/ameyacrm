-- Ameya Heights CRM v5.9 — department tree (divisions + teams)
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_parentId_fkey') THEN
    ALTER TABLE "Department"
      ADD CONSTRAINT "Department_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
