-- Ameya Heights CRM v9.3 — folder mirroring to Drive + background processing.
ALTER TABLE "Folder"     ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncState" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncError" TEXT;
CREATE INDEX IF NOT EXISTS "FileObject_syncState_idx" ON "FileObject"("syncState");
