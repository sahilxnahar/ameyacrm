# Ameya Tally Bridge — live sync

Keeps Ameya Tally in step with the real Tally on your office machine.

**Nothing is exposed to the internet.** Tally stays on your LAN; this agent reads
from it locally and pushes to Ameya over HTTPS. No port forwarding, no firewall
changes.

## One-time setup

1. **Turn on Tally's gateway.** In Tally: `F1 (Help) → Settings → Connectivity →
   Client/Server configuration` → *Tally acts as* = **Both**, *Port* = **9000**.
   Leave Tally running with your company open.
2. **Turn on the endpoint in Ameya.** In Vercel → Settings → Environment
   Variables, add `TALLY_BRIDGE_SECRET` = a long random string
   (`openssl rand -base64 32`). Until this is set the endpoint stays off (503).
3. **Install Node 20+** on the Tally machine (nodejs.org).

## Running it

```bash
set TALLY_BRIDGE_SECRET=<the same value you put in Vercel>
set AMEYA_URL=https://crm.ameyaheights.com

node ameya-tally-bridge.mjs                      # last 30 days
node ameya-tally-bridge.mjs --days 365           # last year
node ameya-tally-bridge.mjs --from 2024-04-01 --to 2025-03-31
node ameya-tally-bridge.mjs --masters-only       # chart of accounts only
node ameya-tally-bridge.mjs                      # add TALLY_COMPANY=... for a specific company
```

Run it once for each company you keep in Tally (set `TALLY_COMPANY`).

## Keeping it in sync automatically

**Windows Task Scheduler:** create a Basic Task → Daily → *Start a program* →
`node` with arguments `C:\path\to\ameya-tally-bridge.mjs --days 7`.

Re-syncing an overlapping period is safe: Ameya skips vouchers it already holds,
so nothing is ever double-posted.

## If something goes wrong

| Message | Meaning |
|---|---|
| `Tally replied ...` / connection refused | Tally isn't running, or the gateway/port isn't enabled (step 1). |
| `bridge is not configured` (503) | `TALLY_BRIDGE_SECRET` isn't set in Vercel (step 2). |
| `Ameya rejected the key` (401) | The secret here doesn't match the one in Vercel. |
