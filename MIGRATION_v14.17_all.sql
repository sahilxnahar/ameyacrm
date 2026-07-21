-- MIGRATION v14.17 — UX quick wins 11–16. Only batch 12 (in-app feedback)
-- needs a schema change: one table for feedback messages. Idempotent —
-- safe to run more than once. Or use the in-app repair button.

CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "path" TEXT,
    "rating" TEXT,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback"("createdAt");
