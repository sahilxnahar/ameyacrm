# Getting v16.27 live — read the order, it matters

Your Vercel deployment list shows **16.17, 21 hours ago, Ready** and nothing
after it. Not a failed build — **no build at all**.

That is the answer to "it's not building". Vercel builds when a commit lands on
`main` in your connected GitHub repo — every row in that list says `main` with a
commit hash. I deliver **zip files**. A zip sitting in `~/Downloads` is invisible
to Vercel. Until the code is unzipped into the repo and pushed, there is nothing
for Vercel to build, and the dashboard will keep showing 16.17 forever.

---

## ⚠️ Before you push: run the SQL first

**Do not deploy first and migrate afterwards. It will take the app down for
everyone, including you, and you will not be able to use the Repair button to
recover.**

Here is why, precisely. The session check does this:

```ts
prisma.session.findUnique({ where: { tokenHash }, include: { user: true } })
```

`include: { user: true }` selects **every** column on `User`. The new build's
Prisma client knows about `twoFactorLastStep` and `twoFactorPendingSecret`, so it
puts them in the SELECT. Your database does not have them yet:

```
ERROR:  column "twoFactorPendingSecret" does not exist
```

Every session read throws. Nobody can sign in. And Admin → Settings → Repair
needs a valid session to reach, so **the recovery button is behind the thing that
is broken**.

The reverse order is completely safe — I verified both directions. Adding
columns to the database while 16.17 is still running changes nothing, because
the old build only selects the columns it knows about.

---

## The order

### 1. Run the two migrations against your Neon database

```bash
psql "$DATABASE_URL" -f MIGRATION_v16.25_all.sql
psql "$DATABASE_URL" -f MIGRATION_v16.26_all.sql
```

Both are idempotent — safe to run twice, safe to run if you already ran one.
Use the **unpooled** (non `-pooler`) Neon connection string for DDL.

Verify, expecting one row each:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'User'
   AND column_name IN ('twoFactorLastStep', 'twoFactorPendingSecret');

SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid
 WHERE typname = 'AuditAction' AND enumlabel = 'TWO_FACTOR_RESET_REFUSED';
```

### 2. Put the code in the repo and push

```bash
cd <your ameyacrm git checkout>
# unzip ameyacrm-v16.27.zip over the working tree, then:
git status            # sanity-check what changed
git add -A
git commit -m "v16.27"
git push origin main
```

Vercel picks it up automatically. Watch the Deployments tab — a new row should
appear within seconds of the push.

### 3. Confirm it actually went out

- The sidebar footer should read **v16.27**, not v16.17.
- The Vercel build log should contain the line **`ƒ Middleware`**. If it does
  not, the edge middleware did not compile, and your cross-origin guard,
  `ENFORCE_2FA` and forced-password-change are still inert (that was AMH-054).
- Click ＋ → **Record a payment**. It should open the "Bank paid" form on the
  cash book, not drop you on a list.

---

## If a build genuinely does fail

**First: clear the status filter.** Your screenshot shows `Status 6/7` — one
status is filtered out, and `Error` is very likely the one being hidden. Set it
to all 7 and any failed deployment will appear.

Then, if there is a failure, it is worth knowing that **the code is not the
cause**. I reproduced Vercel's build exactly — clean `npm install`, then
`npm run vercel-build`, with **no environment variables set at all**:

```
✓ Compiled successfully in 58s
✓ Generating static pages (58/58)
ƒ Middleware   34.8 kB
EXIT=0
```

So the likely candidates, in order:

| Symptom in the log | Cause |
|---|---|
| Nothing at all, no new row | Nothing was pushed to `main` — this is almost certainly it |
| `Invalid/missing environment variables` | A required env var is missing in Vercel. Only three are mandatory: `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY` |
| `Environment Variable references Secret ...` | A Vercel env var points at a deleted secret |
| Build hangs or times out | Hobby tier has a 45-minute ceiling; this build takes ~1–3 minutes, so a hang means something else |
| `prisma generate` fails | `postinstall` runs it too, so this usually means the schema did not get committed |

Send me the build log and I will read it.

---

## One thing to fix in your workflow

Nine releases — v16.18 through v16.26 — never reached production. That includes
the middleware fix, which means the cross-origin write guard, mandatory 2FA and
forced password change have **never actually run** on your live site, and the
invoice PDF fix, which means customers may still be receiving documents that read
`Rs.  1,50,000` or `Rs. Rs.1,50,000`.

The gap is that I hand you a zip and the deployment step is manual and easy to
skip. Two options, either is fine:

- **Deploy after every release.** Unzip → commit → push. Takes two minutes.
- **Give me the repo.** If you connect the GitHub repo to this session, I can
  commit and push directly and you would only ever review the diff.

Whichever you pick, the version number in the sidebar footer is the honest check:
if it does not match the zip I just sent, it is not live.
