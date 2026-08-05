# Ameya CRM Deployment Troubleshooting Summary

**Date:** 6 August 2026  
**Application:** Ameya CRM  
**Target version:** v16.27  
**GitHub repository:** `sahilxnahar/ameyacrm`  
**Vercel project:** `ameyaheights/ameyacrm`

## Final outcome

The v16.27 code was successfully deployed directly to Vercel using the Vercel
CLI.

The successful deployment produced:

- Vercel deployment URL: `https://ameyacrm-mqr1pi153-ameyaheights.vercel.app`
- Project alias: `https://ameyacrm.vercel.app`
- Production custom domain: `https://crm.ameyaheights.com`

The production CRM should be checked for the footer version `v16.27`.

## What happened

### 1. GitHub contained the new code, but the live CRM stayed on v16.17

The local repository was confirmed as:

```text
/Users/sah/Documents/GitHub/ameyacrm
```

The local version file showed:

```text
export const APP_VERSION = 'v16.27';
```

The branch was:

```text
main
```

The GitHub repository contained the v16.27 commits, but the Vercel deployment
list continued to show v16.17.

### 2. Manual ZIP copying caused confusion

Version ZIP files were being kept in Downloads and copied manually into the
GitHub Desktop repository. A previous commit contained only `.DS_Store`, so
Vercel had no new application code to build.

The correct source directory is:

```text
/Users/sah/Documents/GitHub/ameyacrm
```

The ZIP file itself is not deployed automatically just because it exists in
Downloads.

### 3. The wrong Vercel project was opened

The website project contained:

```text
ameyaheights.com
www.ameyaheights.com
```

That is the website project, not the CRM project.

The correct Vercel project is:

```text
ameyaheights/ameyacrm
```

The CRM domains are already correctly attached to that project:

```text
crm.ameyaheights.com
ameyacrm.vercel.app
```

The domain was already valid and configured. It did not need to be added
again.

### 4. Vercel Hobby rejected the original cron configuration

The original `vercel.json` contained:

- A daily cron
- An hourly cron
- A 15-minute worker cron

Vercel Hobby allows only daily cron schedules. The CLI therefore rejected the
deployment before uploading the project:

```text
Hobby accounts are limited to daily cron jobs.
```

The hourly and frequent jobs remain available as API routes. They must be
scheduled through an external scheduler such as cron-job.org, or Vercel must be
upgraded to Pro.

### 5. Vercel rejected `TZ` in `vercel.json`

After the cron issue was removed, Vercel rejected this configuration:

```text
The following environment variables can not be configured: TZ
```

`TZ` is reserved by Vercel and must not be configured in `vercel.json`.

## Final Hobby-compatible `vercel.json`

The file should contain only the daily Vercel cron:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm install",
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Do not add `TZ` to this file.

## Permanent workflow for future versions

After this configuration is committed and pushed, the normal workflow is:

1. Receive or create the new CRM code.
2. Copy the new source files into:

   ```text
   /Users/sah/Documents/GitHub/ameyacrm
   ```

3. Open GitHub Desktop.
4. Confirm the repository is `ameyacrm`.
5. Confirm the branch is `main`.
6. Review the changed files.
7. Enter a commit message.
8. Click **Commit to main**.
9. Click **Push origin**.
10. Open the `ameyaheights/ameyacrm` Vercel project.
11. Wait for the automatic production deployment.
12. Confirm the deployment says `Ready`.
13. Open `https://crm.ameyaheights.com`.
14. Hard refresh with `Cmd + Shift + R`.
15. Confirm the footer version.

There should normally be no need to run `npx vercel --prod` manually. The CLI
was needed here because the GitHub-to-Vercel automatic deployment path had not
triggered and the project configuration blocked the first direct deployment.

## Useful Terminal checks

Run these from the repository:

```bash
cd /Users/sah/Documents/GitHub/ameyacrm
grep APP_VERSION src/config/version.ts
git status --short --branch
git log -1 --oneline
python3 -m json.tool vercel.json
```

Expected version:

```text
export const APP_VERSION = 'v16.27';
```

Expected branch:

```text
## main...origin/main
```

## Manual CLI deployment fallback

Use this only if the automatic GitHub deployment does not start:

```bash
cd /Users/sah/Documents/GitHub/ameyacrm
npx vercel login
npx vercel link
npx vercel --prod
```

When linking, use:

```text
Team: ameyaheights
Project: ameyacrm
```

Do not create a new Vercel project.

## Important files and secrets

- `.env.local` was created by `vercel link` and must remain ignored.
- Never commit `.env.local`.
- Never commit `.env`, `.env.production`, database URLs, API keys, or tokens.
- The Vercel project environment variables remain in Vercel and are not supplied
  by the GitHub repository.

## Troubleshooting guide

### GitHub push succeeds but no Vercel deployment appears

Check:

1. Vercel project is `ameyaheights/ameyacrm`.
2. Repository is `sahilxnahar/ameyacrm`.
3. Production branch is `main`.
4. The Vercel deployment status filter includes all statuses.
5. Ignored Build Step is empty.
6. The GitHub/Vercel connection is still authorized.

### Vercel says the repository is already connected elsewhere

The deployment was started from the wrong Vercel project. Do not create a new
project. Find the existing project connected to
`sahilxnahar/ameyacrm`, and deploy from that project.

### Vercel says the cron expression is not allowed

Vercel Hobby supports only daily cron jobs. Remove hourly and 15-minute cron
entries from `vercel.json`, or upgrade to Pro.

### Vercel says `TZ` cannot be configured

Remove both `env.TZ` and `build.env.TZ` from `vercel.json`. Do not add `TZ` as a
Vercel environment variable.

### The deployment is Ready but the browser still shows the old version

1. Confirm the deployment is marked **Production**, not Preview.
2. Open `https://ameyacrm.vercel.app` directly.
3. Open `https://crm.ameyaheights.com`.
4. Hard refresh with `Cmd + Shift + R`.
5. Check that the domain is attached to the `ameyaheights/ameyacrm` project.

### The domain cannot be added

This is expected if the domain is already attached to the CRM project. Confirm
that the Domains page shows:

```text
crm.ameyaheights.com
Valid Configuration
Production
```

Do not add a duplicate domain or change the existing Squarespace DNS record if
it already points to the Vercel target.

## Current operational limitation

Only `/api/cron/daily` is scheduled by Vercel Hobby after this deployment
configuration change. The following jobs require an external scheduler or a
Vercel Pro plan:

- `/api/cron/auto-release`
- `/api/cron/escalate`
- `/api/cron/worker`
- `/api/cron/reminders`
- `/api/cron/payment-reminders`
- `/api/cron/backup`

The CRM should not be considered fully operational for scheduled automation
until those jobs are scheduled and tested separately.
