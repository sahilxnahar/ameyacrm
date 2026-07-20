-- Ameya Heights CRM v8.1 — personal navigation + query indexes. Safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navPrefs" JSONB;

-- Indexes for the queries the calendar, forecast and escalation run constantly.
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUp_idx"      ON "Lead"("nextFollowUp");
CREATE INDEX IF NOT EXISTS "Lead_status_ownerId_idx"    ON "Lead"("status","ownerId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx"           ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Task_status_idx"            ON "Task"("status");
CREATE INDEX IF NOT EXISTS "PaymentMilestone_dueDate_idx" ON "PaymentMilestone"("dueDate");
CREATE INDEX IF NOT EXISTS "PaymentMilestone_status_idx"  ON "PaymentMilestone"("status");
CREATE INDEX IF NOT EXISTS "Booking_bookedAt_idx"       ON "Booking"("bookedAt");
CREATE INDEX IF NOT EXISTS "CalendarEvent_startAt_idx"  ON "CalendarEvent"("startAt");
CREATE INDEX IF NOT EXISTS "Reminder_dueAt_status_idx"  ON "Reminder"("dueAt","status");
CREATE INDEX IF NOT EXISTS "Unit_projectId_status_idx"  ON "Unit"("projectId","status");
CREATE INDEX IF NOT EXISTS "SocialActivity_isRead_idx"  ON "SocialActivity"("isRead");
