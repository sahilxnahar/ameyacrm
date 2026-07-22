-- MIGRATION v14.25 — Site Telemetry (31-plan #27, software side). Adds 2 tables:
-- a device registry and their readings. Idempotent. Or use the in-app repair button.

CREATE TABLE IF NOT EXISTS "TelemetryDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sensor',
    "projectId" TEXT,
    "location" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SiteReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "projectId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelemetryDevice_deviceKey_key" ON "TelemetryDevice"("deviceKey");
CREATE INDEX IF NOT EXISTS "TelemetryDevice_projectId_idx" ON "TelemetryDevice"("projectId");
CREATE INDEX IF NOT EXISTS "SiteReading_deviceId_recordedAt_idx" ON "SiteReading"("deviceId", "recordedAt");
CREATE INDEX IF NOT EXISTS "SiteReading_projectId_metric_idx" ON "SiteReading"("projectId", "metric");
CREATE INDEX IF NOT EXISTS "SiteReading_recordedAt_idx" ON "SiteReading"("recordedAt");
