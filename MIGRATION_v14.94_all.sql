-- Ameya Heights CRM — migration for v14.94 (Ameya Tally phase 7: bank reconciliation)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.94.
-- (Run the earlier Tally migrations — v14.88, v14.89, v14.93 — first if you haven't.)

ALTER TABLE "TallyVoucherLine" ADD COLUMN IF NOT EXISTS "clearedDate" TIMESTAMP(3);
