-- Ameya Heights CRM — migration for v15.11 (Marketing Library: uploads + Drive links)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.11.

CREATE TABLE IF NOT EXISTS "MarketingLibraryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "kind" TEXT NOT NULL DEFAULT 'file',
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "fileType" TEXT,
    "sizeBytes" INTEGER,
    "folderPath" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingLibraryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketingLibraryItem_category_idx" ON "MarketingLibraryItem"("category");
CREATE INDEX IF NOT EXISTS "MarketingLibraryItem_createdAt_idx" ON "MarketingLibraryItem"("createdAt");
