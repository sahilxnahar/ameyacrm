-- ════════════════════════════════════════════════════════════════════════════
--  Ameya OS — unblock login
--
--  Symptom: every signed-in page shows "Something went wrong", and logging in
--  bounces you to /settings/security?force=1 which shows the same thing.
--
--  Cause: the signed-in layout reads four things from the database on EVERY
--  route. If one of them is missing — a deploy whose migration was never run —
--  that layout throws before anything inside it renders, so all 200 screens
--  fail at once, including every screen carrying the Repair button.
--
--  This adds those four back. Safe to run more than once: each statement is
--  IF NOT EXISTS, and none of them touches or removes any data.
--
--  Run it against the SAME database the app uses — the one in DATABASE_URL.
--  On Neon, check you are on the right BRANCH; the usual reason pasting SQL
--  "does nothing" is that it went to a different branch than the app reads.
-- ════════════════════════════════════════════════════════════════════════════

-- Which database am I actually connected to? Check this matches DATABASE_URL.
SELECT current_database() AS database, current_schema() AS schema;

-- ── The four the layout cannot start without ────────────────────────────────
ALTER TABLE "User"    ADD COLUMN IF NOT EXISTS "navPrefs"        JSONB;
ALTER TABLE "User"    ADD COLUMN IF NOT EXISTS "topNavPrefs"     JSONB;
ALTER TABLE "User"    ADD COLUMN IF NOT EXISTS "activeProjectId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isActive"        BOOLEAN NOT NULL DEFAULT true;

-- ── Did it work? ────────────────────────────────────────────────────────────
-- Expect four rows. Any that is missing here is still missing.
SELECT table_name AS "table", column_name AS "column"
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND (   (table_name = 'User'    AND column_name IN ('navPrefs','topNavPrefs','activeProjectId'))
       OR (table_name = 'Project' AND column_name  = 'isActive'))
ORDER BY 1, 2;

-- ════════════════════════════════════════════════════════════════════════════
--  Now log in again.
--
--  If you land on "Please set a new password to continue", that is correct —
--  set one and you are through. If you would rather skip that step, uncomment
--  the line below and put your own email in it. Only do this for your own
--  account, and only because you are locked out.
-- ════════════════════════════════════════════════════════════════════════════

-- UPDATE "User" SET "mustChangePassword" = false WHERE lower(email) = lower('you@ameyaheights.com');

-- ════════════════════════════════════════════════════════════════════════════
--  If pages STILL fail after this, the database is behind in other places too.
--  Run DB-DRIFT-CHECK.sql (read-only) — it lists every table and column this
--  build expects and yours does not have. Then, once you can reach any screen,
--  the red banner at the top has a Repair button that applies the rest.
-- ════════════════════════════════════════════════════════════════════════════
