-- Ameya Heights CRM v7.2 — overdue escalation ledger
CREATE TABLE IF NOT EXISTS "OverdueNotice" (
  "id" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "href" TEXT,
  "lastPushAt" TIMESTAMP(3),
  "lastEmailAt" TIMESTAMP(3),
  "lastWhatsappAt" TIMESTAMP(3),
  "pushCount" INTEGER NOT NULL DEFAULT 0,
  "emailCount" INTEGER NOT NULL DEFAULT 0,
  "whatsappQueued" BOOLEAN NOT NULL DEFAULT false,
  "snoozedUntil" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OverdueNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OverdueNotice_itemKey_userId_key" ON "OverdueNotice"("itemKey","userId");
CREATE INDEX IF NOT EXISTS "OverdueNotice_userId_resolvedAt_idx" ON "OverdueNotice"("userId","resolvedAt");
CREATE INDEX IF NOT EXISTS "OverdueNotice_resolvedAt_idx" ON "OverdueNotice"("resolvedAt");
