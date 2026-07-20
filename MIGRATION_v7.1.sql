-- Ameya Heights CRM v7.1 — per-person social accounts + personal WhatsApp
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;

CREATE TABLE IF NOT EXISTS "UserSocialAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "SocialChannel" NOT NULL,
  "handle" TEXT NOT NULL,
  "profileUrl" TEXT,
  "displayName" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSocialAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSocialAccount_userId_channel_handle_key" ON "UserSocialAccount"("userId","channel","handle");
CREATE INDEX IF NOT EXISTS "UserSocialAccount_channel_idx" ON "UserSocialAccount"("channel");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='UserSocialAccount_userId_fkey') THEN
    ALTER TABLE "UserSocialAccount" ADD CONSTRAINT "UserSocialAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
