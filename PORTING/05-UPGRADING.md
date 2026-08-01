# 5 — Installing a new version

The routine for every `.zip` you receive. Ten minutes.

## The order matters

1. **Back up the database** (`03-DATABASE.md`) — non-negotiable
2. **Run the migration SQL** shipped with the release
3. **Then** deploy the new code

Migration before code, every time. New code expects the new columns; old code
ignores them harmlessly. Deploying code first gives you a window where the app
queries columns that do not exist yet, and every page in that area 500s.

## Step by step

```bash
# 1. Back up
pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f "backup-before-v15.94.dump"

# 2. Migrate
psql "$DATABASE_URL_UNPOOLED" -f MIGRATION_v15.96_all.sql

# 3. Deploy — unzip over your repo, then
git add -A
git commit -m "Upgrade to v15.94"
git push
```

Vercel builds automatically on push.

## Preserve your local settings

If you have edited anything after receiving the previous zip — branding, a
tweaked template — those files will be overwritten. Check before you commit:

```bash
git status
git diff
```

`git diff` shows exactly what the new version changes. Anything you recognise as
your own edit, restore before committing.

## After deploying

- [ ] Sign in
- [ ] Open the area the release changed
- [ ] **Admin → Health** for anything red
- [ ] Post a test entry in Ameya Tally, confirm the trial balance still balances

## Rolling back

**Code:** Vercel → Deployments → the previous one → "Promote to Production".
Instant.

**Database:** restore the dump you took at step 1.

If a migration only *added* things — new tables, new nullable columns — the old
code runs against the new schema perfectly well. In that case roll back the code
alone and leave the database. That is the usual case and the quickest fix.
