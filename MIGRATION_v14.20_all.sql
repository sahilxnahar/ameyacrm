-- MIGRATION v14.20 — I4 universal record linking + I5 access context (no schema).
-- Adds 1 table. Idempotent. Or use the in-app "Fix it now" button.

CREATE TABLE IF NOT EXISTS "RecordLink" (
    "id" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'related',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecordLink_fromType_fromId_idx" ON "RecordLink"("fromType", "fromId");
CREATE INDEX IF NOT EXISTS "RecordLink_toType_toId_idx" ON "RecordLink"("toType", "toId");
CREATE UNIQUE INDEX IF NOT EXISTS "RecordLink_fromType_fromId_toType_toId_key" ON "RecordLink"("fromType", "fromId", "toType", "toId");
