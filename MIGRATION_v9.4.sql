-- Ameya Heights CRM v9.4 — indexes for the queries the hot pages run.
-- Full-text index for the keyword pre-filter in document search.
-- Wrapped so an older Postgres without the extension cannot fail the migration.
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "DocChunk_content_fts_idx" ON "DocChunk" USING GIN (to_tsvector('english', "content"));
EXCEPTION WHEN others THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Document_folderId_deletedAt_idx" ON "Document"("folderId","deletedAt");
CREATE INDEX IF NOT EXISTS "Folder_parentId_deletedAt_idx"   ON "Folder"("parentId","deletedAt");
CREATE INDEX IF NOT EXISTS "FolderPermission_folderId_idx"   ON "FolderPermission"("folderId");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx"         ON "TaskAssignee"("userId");
CREATE INDEX IF NOT EXISTS "DocumentVersion_fileId_idx"      ON "DocumentVersion"("fileId");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_leadId_idx"    ON "MailThreadMessage"("leadId");
