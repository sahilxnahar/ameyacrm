

-- ─────────────────────────────────────────────────────────────
-- WorkRequest interdept (v14.18)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WorkRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'RAISED',
    "fromDeptId" TEXT,
    "toDeptId" TEXT,
    "raisedById" TEXT,
    "ownerId" TEXT,
    "dueOn" TIMESTAMP(3),
    "entityType" TEXT,
    "entityId" TEXT,
    "linkedTaskId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkRequestComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkRequest_reference_key" ON "WorkRequest"("reference");

CREATE INDEX IF NOT EXISTS "WorkRequest_toDeptId_status_idx" ON "WorkRequest"("toDeptId", "status");

CREATE INDEX IF NOT EXISTS "WorkRequest_fromDeptId_status_idx" ON "WorkRequest"("fromDeptId", "status");

CREATE INDEX IF NOT EXISTS "WorkRequest_status_idx" ON "WorkRequest"("status");

CREATE INDEX IF NOT EXISTS "WorkRequest_createdAt_idx" ON "WorkRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "WorkRequestEvent_requestId_idx" ON "WorkRequestEvent"("requestId");

CREATE INDEX IF NOT EXISTS "WorkRequestComment_requestId_idx" ON "WorkRequestComment"("requestId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkRequestEvent_requestId_fkey') THEN
    ALTER TABLE "WorkRequestEvent" ADD CONSTRAINT "WorkRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkRequestComment_requestId_fkey') THEN
    ALTER TABLE "WorkRequestComment" ADD CONSTRAINT "WorkRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
