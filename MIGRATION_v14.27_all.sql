-- MIGRATION v14.27 — Chat attachments (forward/screenshot an email into a thread).
-- Adds 1 table. Idempotent. Or use the in-app "Fix it now" button.

CREATE TABLE IF NOT EXISTS "ChatAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatAttachment_messageId_fkey') THEN
    ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
