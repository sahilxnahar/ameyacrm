-- Ameya Heights CRM v9.0 — two-way email, sequences, SSO. Safe to re-run.

DO $$ BEGIN CREATE TYPE "MailDirection"    AS ENUM ('INBOUND','OUTBOUND');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SequenceStatus"   AS ENUM ('ACTIVE','PAUSED','ARCHIVED');               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EnrollmentStatus" AS ENUM ('RUNNING','REPLIED','FINISHED','STOPPED');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailThreadMessage" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "threadKey" TEXT NOT NULL,
  "direction" "MailDirection" NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddresses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT, "bodyText" TEXT, "snippet" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT, "customerId" TEXT, "userId" TEXT,
  "trackToken" TEXT, "openedAt" TIMESTAMP(3),
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "enrollmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailThreadMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_externalId_key" ON "MailThreadMessage"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_trackToken_key" ON "MailThreadMessage"("trackToken");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_leadId_sentAt_idx"     ON "MailThreadMessage"("leadId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_customerId_sentAt_idx" ON "MailThreadMessage"("customerId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_threadKey_idx"         ON "MailThreadMessage"("threadKey");

CREATE TABLE IF NOT EXISTS "EmailSequence" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "SequenceStatus" NOT NULL DEFAULT 'PAUSED',
  "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
  "stopOnStage" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SequenceStep" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "dayOffset" INTEGER NOT NULL DEFAULT 0,
  "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceStep_sequenceId_ordinal_key" ON "SequenceStep"("sequenceId","ordinal");

CREATE TABLE IF NOT EXISTS "SequenceEnrollment" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'RUNNING',
  "stepsSent" INTEGER NOT NULL DEFAULT 0,
  "nextStepAt" TIMESTAMP(3), "enrolledById" TEXT,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), "endReason" TEXT,
  CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceEnrollment_sequenceId_leadId_key" ON "SequenceEnrollment"("sequenceId","leadId");
CREATE INDEX IF NOT EXISTS "SequenceEnrollment_status_nextStepAt_idx" ON "SequenceEnrollment"("status","nextStepAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceStep_sequenceId_fkey') THEN
    ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceEnrollment_sequenceId_fkey') THEN
    ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Ameya Heights CRM v9.2 — login hardening. Safe to re-run.

ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "label"      TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "ipAddress"  TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "country"    TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "userAgent"  TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "revokedAt"  TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorGraceUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allowForeignAccess"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastCountry"         TEXT;

ALTER TABLE "LoginHistory" ADD COLUMN IF NOT EXISTS "country" TEXT;

CREATE TABLE IF NOT EXISTS "DeviceApproval" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "deviceHash" TEXT NOT NULL,
  "ipAddress" TEXT, "country" TEXT, "userAgent" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceApproval_token_key"        ON "DeviceApproval"("token");
CREATE INDEX IF NOT EXISTS "DeviceApproval_userId_createdAt_idx"    ON "DeviceApproval"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "DeviceApproval_expiresAt_idx"           ON "DeviceApproval"("expiresAt");
-- Ameya Heights CRM v9.3 — folder mirroring to Drive + background processing.
ALTER TABLE "Folder"     ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncState" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncError" TEXT;
CREATE INDEX IF NOT EXISTS "FileObject_syncState_idx" ON "FileObject"("syncState");
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
-- Ameya Heights CRM v9.5 — rate limiting.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_bucket_windowStart_key" ON "RateLimit"("bucket","windowStart");
CREATE INDEX IF NOT EXISTS "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
-- Ameya Heights CRM v10.0 — per-person active project.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeProjectId" TEXT;
-- Ameya Heights CRM v10.2 — cash book and vouchers.
DO $$ BEGIN CREATE TYPE "VoucherKind"   AS ENUM ('CASH_RECEIVED','CASH_PAID','MATERIAL_RECEIVED','MATERIAL_ISSUED','BANK_RECEIVED','BANK_PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT','POSTED','CANCELLED');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PayMode"       AS ENUM ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Voucher" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "kind" "VoucherKind" NOT NULL,
  "status" "VoucherStatus" NOT NULL DEFAULT 'POSTED',
  "voucherDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "partyName" TEXT NOT NULL,
  "partyPhone" TEXT,
  "vendorId" TEXT, "customerId" TEXT, "leadId" TEXT,
  "projectId" TEXT, "bookingId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "mode" "PayMode" NOT NULL DEFAULT 'CASH',
  "reference" TEXT, "narration" TEXT,
  "materialName" TEXT, "quantity" DECIMAL(12,3), "unit" TEXT, "rate" DECIMAL(12,2),
  "gstRate" DECIMAL(5,2), "gstAmount" DECIMAL(14,2),
  "attachmentId" TEXT, "createdById" TEXT, "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Voucher_number_key"            ON "Voucher"("number");
CREATE INDEX IF NOT EXISTS "Voucher_kind_voucherDate_idx"         ON "Voucher"("kind","voucherDate");
CREATE INDEX IF NOT EXISTS "Voucher_projectId_voucherDate_idx"    ON "Voucher"("projectId","voucherDate");
CREATE INDEX IF NOT EXISTS "Voucher_status_idx"                   ON "Voucher"("status");
CREATE INDEX IF NOT EXISTS "Voucher_partyName_idx"                ON "Voucher"("partyName");

-- v10.3 — bank trail on vouchers -------------------------------------------
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "utr" TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "paidOn" TIMESTAMP(3);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "utrEnteredById" TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "utrEnteredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Voucher_utr_idx" ON "Voucher"("utr");

-- v10.5 — finance ledger is appointed, never inherited ------------------------
-- Three new permission keys. Deliberately granted to NOBODY here: Super Admins
-- get them implicitly, and everyone else is appointed in Admin > Finance Access.
INSERT INTO "Permission" ("id", "key", "module", "description", "createdAt") VALUES
  ('perm_fin_ledger_view',   'finance.ledger.view',   'finance', 'See expenses, payments made and the cash book', NOW()),
  ('perm_fin_ledger_manage', 'finance.ledger.manage', 'finance', 'Record and cancel payments, and enter UTRs',    NOW()),
  ('perm_fin_access_manage', 'finance.access.manage', 'finance', 'Appoint who may see the money',                 NOW())
ON CONFLICT ("key") DO NOTHING;

-- Belt and braces: if any role was previously granted these keys by an earlier
-- experiment, take them away. Access must come from an explicit appointment.
DELETE FROM "RolePermission"
 WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" LIKE 'finance.ledger.%');

-- Show who can currently see the money (Super Admins are implicit and will not
-- be listed). A fresh install correctly returns no rows.
SELECT u."name", u."email", p."key"
  FROM "UserPermission" up
  JOIN "User" u ON u."id" = up."userId"
  JOIN "Permission" p ON p."id" = up."permissionId"
 WHERE p."key" LIKE 'finance.ledger.%' AND up."effect" = 'ALLOW'
 ORDER BY u."name";

-- v10.6 — AI sees everything, answers per person ------------------------------
ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "requiredPermission" TEXT;
ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
CREATE INDEX IF NOT EXISTS "DocChunk_folderId_idx" ON "DocChunk"("folderId");
CREATE INDEX IF NOT EXISTS "DocChunk_requiredPermission_idx" ON "DocChunk"("requiredPermission");
CREATE INDEX IF NOT EXISTS "DocChunk_entityType_entityId_idx" ON "DocChunk"("entityType", "entityId");

-- v10.6 — connected external accounts (WhatsApp, Meta, Google Ads) -------------
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id"            TEXT NOT NULL,
  "provider"      TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "accountName"   TEXT,
  "accountId"     TEXT,
  "accessToken"   TEXT,
  "refreshToken"  TEXT,
  "expiresAt"     TIMESTAMP(3),
  "scopes"        TEXT,
  "meta"          JSONB,
  "lastCheckedAt" TIMESTAMP(3),
  "lastError"     TEXT,
  "connectedById" TEXT,
  "connectedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_provider_key" ON "IntegrationConnection"("provider");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_status_idx" ON "IntegrationConnection"("status");

-- v10.7 — templates you write yourself, on any channel -----------------------
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id"             TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "channel"        TEXT NOT NULL,
  "category"       TEXT,
  "language"       TEXT NOT NULL DEFAULT 'en',
  "subject"        TEXT,
  "header"         TEXT,
  "body"           TEXT NOT NULL,
  "footer"         TEXT,
  "buttons"        JSONB,
  "description"    TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "metaStatus"     TEXT,
  "metaTemplateId" TEXT,
  "metaRejection"  TEXT,
  "submittedAt"    TIMESTAMP(3),
  "reviewedAt"     TIMESTAMP(3),
  "usageCount"     INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"     TIMESTAMP(3),
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_key_key" ON "MessageTemplate"("key");
CREATE INDEX IF NOT EXISTS "MessageTemplate_channel_isActive_idx" ON "MessageTemplate"("channel", "isActive");
CREATE INDEX IF NOT EXISTS "MessageTemplate_metaStatus_idx" ON "MessageTemplate"("metaStatus");

-- Four starter templates, already inside Meta's rules. Edit the wording freely;
-- just keep a word before the first variable and after the last one.
INSERT INTO "MessageTemplate" ("id","key","name","channel","category","language","header","body","footer","metaStatus","createdAt","updatedAt") VALUES
 ('tpl_pay_due','payment_reminder','Payment reminder','WHATSAPP','UTILITY','en','Payment reminder',
  'Hello {{buyer.firstName}}, an instalment of Rs {{payment.amount}} for unit {{unit.code}} at {{project.name}} is due on {{payment.dueDate}}. Please ignore this message if you have already paid.',
  'Ameya Heights LLP','DRAFT',NOW(),NOW()),
 ('tpl_pay_rcvd','payment_received','Payment received','WHATSAPP','UTILITY','en','Payment received',
  'Thank you {{buyer.firstName}}. We have received Rs {{payment.amount}} towards unit {{unit.code}} on {{payment.receivedOn}}. Your receipt is attached in your buyer portal.',
  'Ameya Heights LLP','DRAFT',NOW(),NOW()),
 ('tpl_visit','site_visit_confirmed','Site visit confirmed','WHATSAPP','UTILITY','en','Site visit confirmed',
  'Hello {{buyer.firstName}}, your site visit to {{project.name}} is confirmed. The address is {{project.address}}. Please call {{company.phone}} if you need directions.',
  'Ameya Heights LLP','DRAFT',NOW(),NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "MessageTemplate" ("id","key","name","channel","language","subject","body","createdAt","updatedAt") VALUES
 ('tpl_stmt','account_statement','Account statement','EMAIL','en','Statement for {{unit.code}} at {{project.name}}',
  E'Dear {{buyer.name}},\n\nPlease find below the current position on unit {{unit.code}} at {{project.name}}.\n\nAgreement value: Rs {{booking.value}}\nBalance outstanding: Rs {{payment.balance}}\nNext instalment: Rs {{payment.amount}}, due {{payment.dueDate}}\n\nDo write back if anything looks wrong.\n\nRegards,\n{{sender.name}}\n{{company.name}}',
  NOW(),NOW())
ON CONFLICT ("key") DO NOTHING;

-- v10.8 — vendor bank details -------------------------------------------------
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "pan" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "bankBranch" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "paymentNotes" TEXT;

-- v10.9 — ad copy templates ---------------------------------------------------
-- Written inside each platform's real character limits. Edit the wording, but
-- keep the headline short: Google cuts at 30 characters, Meta at 40.
INSERT INTO "MessageTemplate" ("id","key","name","channel","category","language","header","body","createdAt","updatedAt") VALUES
 ('tpl_ad_g_launch','ad_google_launch','Google Search — project launch','AD','GOOGLE_SEARCH','en',
  '3BHK Homes in Bangalore',
  'Spacious 3BHK residences at {{project.name}}. Ready to visit this weekend. Book a site visit today.',
  NOW(),NOW()),
 ('tpl_ad_g_nri','ad_google_nri','Google Search — NRI buyers','AD','GOOGLE_SEARCH','en',
  'Bangalore Homes for NRIs',
  'Full support for NRI buyers at {{project.name}}. Documentation and finance handled.',
  NOW(),NOW()),
 ('tpl_ad_meta_feed','ad_meta_feed','Meta feed — site visit','AD','META_FEED','en',
  'Visit {{project.name}} this weekend',
  'Thoughtfully planned homes in Bangalore by {{company.name}}. Message us to arrange a site visit.',
  NOW(),NOW()),
 ('tpl_ad_meta_story','ad_meta_story','Instagram story — walkthrough','AD','META_STORY','en',
  'See inside {{project.name}}',
  'Swipe up for a walkthrough of our latest homes in Bangalore.',
  NOW(),NOW())
ON CONFLICT ("key") DO NOTHING;

-- v11.2 — getting new joiners signed in ---------------------------------------
CREATE TABLE IF NOT EXISTS "UserOnboarding" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "tokenHash"     TEXT NOT NULL,
  "tokenExpires"  TIMESTAMP(3) NOT NULL,
  "tokenUsedAt"   TIMESTAMP(3),
  "welcomeSentAt" TIMESTAMP(3),
  "lastRemindAt"  TIMESTAMP(3),
  "remindCount"   INTEGER NOT NULL DEFAULT 0,
  "completedAt"   TIMESTAMP(3),
  "stoppedReason" TEXT,
  "lastError"     TEXT,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserOnboarding_userId_key" ON "UserOnboarding"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserOnboarding_tokenHash_key" ON "UserOnboarding"("tokenHash");
CREATE INDEX IF NOT EXISTS "UserOnboarding_completedAt_lastRemindAt_idx" ON "UserOnboarding"("completedAt", "lastRemindAt");

-- v11.6 — recurring tasks, vendor email, site photos ---------------------------
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatEvery" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatUnit" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatUntil" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatedFromId" TEXT;

ALTER TABLE "MailThreadMessage" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
CREATE INDEX IF NOT EXISTS "MailThreadMessage_vendorId_idx" ON "MailThreadMessage"("vendorId");

-- v12.2 — WhatsApp uploads ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "WhatsappSession" (
  "id"        TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "userId"    TEXT,
  "state"     TEXT NOT NULL DEFAULT 'IDLE',
  "folderId"  TEXT,
  "offered"   JSONB,
  "lastSeen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "uploads"   INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappSession_phone_key" ON "WhatsappSession"("phone");
CREATE INDEX IF NOT EXISTS "WhatsappSession_expiresAt_idx" ON "WhatsappSession"("expiresAt");

CREATE TABLE IF NOT EXISTS "WhatsappMessage" (
  "id"         TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "phone"      TEXT NOT NULL,
  "userId"     TEXT,
  "kind"       TEXT NOT NULL,
  "body"       TEXT,
  "mediaId"    TEXT,
  "filename"   TEXT,
  "handled"    BOOLEAN NOT NULL DEFAULT false,
  "outcome"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappMessage_externalId_key" ON "WhatsappMessage"("externalId");
CREATE INDEX IF NOT EXISTS "WhatsappMessage_phone_createdAt_idx" ON "WhatsappMessage"("phone", "createdAt");

-- v12.7 — website audits ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MarketingAudit" (
  "id"        TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "hostname"  TEXT NOT NULL,
  "score"     INTEGER,
  "summary"   TEXT,
  "findings"  JSONB,
  "output"    JSONB,
  "signals"   JSONB,
  "model"     TEXT,
  "error"     TEXT,
  "runById"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketingAudit_kind_createdAt_idx" ON "MarketingAudit"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingAudit_hostname_idx" ON "MarketingAudit"("hostname");
