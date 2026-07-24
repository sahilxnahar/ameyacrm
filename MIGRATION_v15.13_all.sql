-- Ameya Heights CRM — migration for v15.13 (channel-partner commission basis)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.13.
--
-- Adds a commission *basis* to channel partners so a deal can be paid as a
-- percentage of sale, as a number of months' rent (commercial leases), or as
-- a flat fee — instead of assuming everything is a percentage.

DO $$ BEGIN
  CREATE TYPE "CommissionBasis" AS ENUM ('PERCENT_OF_SALE', 'MONTHS_OF_RENT', 'FLAT_FEE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'PERCENT_OF_SALE';
ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "commissionMonths" DECIMAL(5, 2);
ALTER TABLE "ChannelPartner" ADD COLUMN IF NOT EXISTS "commissionFlat" DECIMAL(14, 2);
