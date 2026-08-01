# Porting Ameya CRM

Everything needed to move this CRM onto a server — a fresh one, a different
host, or a copy for testing.

**Read these in order.** Each file is self-contained; you do not need to have
read the previous one, but the order is the order you will need them.

| File | What it covers | When you need it |
|---|---|---|
| `01-FIRST-DEPLOY.md` | Getting it running from nothing | Setting it up the first time |
| `02-ENVIRONMENT.md` | Every setting, what it does, what breaks without it | Whenever something says "not configured" |
| `03-DATABASE.md` | Migrations, backups, restoring | Before every upgrade |
| `04-MOVING-HOSTS.md` | Vercel → elsewhere, or a full self-host | Changing provider |
| `05-UPGRADING.md` | Installing a new version safely | Every new .zip you receive |
| `06-TROUBLESHOOTING.md` | Symptoms → causes → fixes | When something is wrong |
| `scripts/` | Ready-to-run commands | Alongside the guides |

## The 60-second version

The CRM is a Next.js application with a PostgreSQL database. It needs three
things and nothing else:

1. **A PostgreSQL database** (Neon is what it runs on today; any Postgres 14+ works)
2. **Somewhere to run Node.js 20+** (Vercel today; any VPS or container host works)
3. **Environment variables** — at minimum a database URL and a session secret

Everything else — email, WhatsApp, Razorpay, the Tally bridge, AI — is optional
and stays switched off until you supply its key. Nothing breaks when a key is
missing; the relevant feature simply reports that it is not configured.

## The one rule

**Take a database backup before every upgrade.** `03-DATABASE.md` has the exact
command. It takes ten seconds and it is the difference between a bad afternoon
and a lost week.
