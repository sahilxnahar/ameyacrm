-- Ameya Heights CRM — migration for v15.75 (Due Diligence RecordType expansion)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.75.
-- Adds the additional record types (fire NOC, airport-height, environment, water,
-- electricity, land title, EC, patta, chitta, adangal, survey sketch, FMB, NA order).

ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'FIRE_NOC';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'AIRPORT_HEIGHT_CLEARANCE';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'ENVIRONMENT_CLEARANCE';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'WATER_APPROVAL';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'ELECTRICITY_APPROVAL';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'LAND_TITLE';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'EC';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'PATTA';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'CHITTA';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'ADANGAL';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'SURVEY_SKETCH';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'FMB';
ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'NA_ORDER';
