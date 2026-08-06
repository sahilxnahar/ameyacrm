# 6 — When something is wrong

Symptoms, causes, fixes.

---

## The build fails

**`Environment validation failed`**
A required variable is missing or malformed. The error names it. Check
`02-ENVIRONMENT.md`, and check for a stray space or quote in the value.

**`Cannot find module '.prisma/client'`**
Prisma's client was not generated. `npx prisma generate`, then rebuild.

**`Type error: Property 'x' does not exist`**
The code is newer than the database schema. You deployed before migrating —
run the migration, then redeploy.

## The app builds but every page fails

**`Can't reach database server`**
- `DATABASE_URL` is wrong or the database is asleep (Neon free tier sleeps —
  first request wakes it, ~2s)
- Missing `?sslmode=require` on the connection string
- Your host's IP is not allowed in the database's network settings

**`relation "X" does not exist`**
A migration did not run. Apply it (`03-DATABASE.md`).

**`Too many connections`**
You are using the direct URL where the pooled one belongs. `DATABASE_URL` must
be the **pooled** string; only `DATABASE_URL_UNPOOLED` is direct.

## Sign-in problems

**Everyone was signed out at once**
`SESSION_SECRET` changed. If you did not change it, check whether someone
redeployed with a different value — and treat that as a possible incident.

**"Session expired" immediately after signing in**
- `APP_URL` does not match the actual URL, so the cookie is scoped to the wrong
  domain
- Behind a proxy without `X-Forwarded-Proto` set, so the app thinks it is on
  HTTP and refuses to set a secure cookie

**A guest hits a redirect loop**
Confirm `/demo` sits **outside** the `(app)` route group (it lives in `(demo)`).
Inside `(app)`, the layout's own guard redirects a guest back to `/demo`, which
re-enters the same layout — an infinite loop. The current layout avoids this by
putting the demo in a separate route group.

## Scheduled jobs are not running

1. Is `CRON_SECRET` set?
2. Vercel → Settings → Cron Jobs — are they listed?
3. Hit one by hand and read the reply:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://your-url/api/cron/worker
```

`401` means the secret does not match. `503` means the feature is not
configured. `200` means it works and the schedule is the problem.

## Payments are not reconciling

1. Razorpay dashboard → Webhooks → is your URL there and **active**?
2. Does `RAZORPAY_WEBHOOK_SECRET` match on both sides exactly?
3. Is `payment.captured` among the subscribed events?
4. Admin → Webhooks shows what arrived and what failed, with the error.

A signature mismatch is rejected silently by design — an endpoint that explains
*why* a signature failed is an endpoint that helps someone forge one.

## The Tally bridge will not connect

| Message | Cause |
|---|---|
| Connection refused | Tally is not running, or its gateway is off (`tools/tally-bridge/README.md`, step 1) |
| `bridge is not configured` (503) | `TALLY_BRIDGE_SECRET` not set on the server |
| `Ameya rejected the key` (401) | The two secrets do not match |
| Connects, imports nothing | No vouchers in that date range — try `--days 365` |

## Everything is slow

1. **Where is the database?** A Mumbai app with a US database pays ~200 ms per
   query. This is the most common cause by far.
2. **Neon free tier** sleeps after inactivity; the first request pays the wake-up.
3. Vercel → Functions → Duration shows which route is actually slow.

## Reading the logs

**Vercel:** Deployments → the deployment → Functions → pick the route.
**Self-hosted:** `pm2 logs ameya-crm --lines 200`, or `docker logs -f ameya-crm`.

Errors are also written to the database and shown under **Admin → Health**,
which is usually faster than digging through a log viewer.

## Nothing here helped

Collect these before asking for help — they answer the first three questions
anyone will ask:

- What you did, and what happened instead
- The exact error, including the stack trace
- The version (`src/config/changelog.ts` → `APP_VERSION`)
- Whether it ever worked, and what changed in between
