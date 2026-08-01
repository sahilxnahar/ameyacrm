# 4 — Moving to a different host

Nothing in this application is tied to Vercel. It is a standard Next.js app: any
host that runs Node.js 20+ will serve it.

## What has to move

1. **The database** — a `pg_dump` / `pg_restore` (`03-DATABASE.md`)
2. **The environment variables** — copy them across
3. **The uploaded files** — if you use Vercel Blob, see below
4. **DNS** — point your domain at the new host

## Option A — your own server (VPS, EC2, DigitalOcean)

```bash
# On the server, as a non-root user
git clone <your-private-repo> ameya-crm
cd ameya-crm
npm ci
cp .env.example .env      # then fill it in — see 02-ENVIRONMENT.md
npx prisma generate
npm run build
```

Run it under a process manager so it survives a crash and a reboot:

```bash
npm install -g pm2
pm2 start npm --name ameya-crm -- start
pm2 save
pm2 startup        # prints a command to run as root — run it
```

Put nginx in front for TLS:

```nginx
server {
  listen 443 ssl http2;
  server_name crm.ameyaheights.com;

  ssl_certificate     /etc/letsencrypt/live/crm.ameyaheights.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/crm.ameyaheights.com/privkey.pem;

  client_max_body_size 50M;   # uploads: without this, large files fail at the proxy

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Certificates: `sudo certbot --nginx -d crm.ameyaheights.com`.

**You must replace the cron jobs.** Vercel ran them for you; now you do:

```cron
# crontab -e   — CRON_SECRET must match your environment
*/15 * * * * curl -sS -H "Authorization: Bearer $CRON_SECRET" https://crm.ameyaheights.com/api/cron/worker
0 7 * * *    curl -sS -H "Authorization: Bearer $CRON_SECRET" https://crm.ameyaheights.com/api/cron/payment-reminders
30 7 * * *   curl -sS -H "Authorization: Bearer $CRON_SECRET" https://crm.ameyaheights.com/api/cron/briefing
0 3 * * *    curl -sS -H "Authorization: Bearer $CRON_SECRET" https://crm.ameyaheights.com/api/cron/housekeeping
```

Check `vercel.json` for the current list and schedules.

## Option B — Docker

```dockerfile
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package*.json prisma ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t ameya-crm .
docker run -d --name ameya-crm -p 3000:3000 --env-file .env --restart unless-stopped ameya-crm
```

`openssl` in the base image is not optional — Prisma's query engine needs it,
and its absence produces a confusing startup error.

## Option C — another managed host

Railway, Render, Fly.io and AWS Amplify all deploy this without changes. Set the
environment variables, point them at the repo, and check whether the host offers
scheduled jobs — if not, use the cron list above from anywhere that can reach
your URL.

## Moving the uploaded files

If you are on Vercel Blob and leaving Vercel, move file storage to S3 (or any
S3-compatible service — Cloudflare R2, Backblaze B2, MinIO):

1. Create a bucket, **private**, not public.
2. Set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`.
3. Copy the existing files across.
4. Unset `BLOB_READ_WRITE_TOKEN` so the app uses S3.

Keep the bucket private. The CRM signs its own time-limited download URLs and
checks permission on every request; a public bucket bypasses that entirely and
puts your agreements on the open internet.

## Cutting over with no downtime

1. Deploy to the new host with the **same** database
2. Test it thoroughly on its temporary URL
3. Lower your DNS TTL to 300s a day beforehand
4. Point DNS at the new host
5. Leave the old one running 24 hours while DNS propagates
6. Then decommission

Test on the shared database *before* moving DNS. Discovering a missing
environment variable while your team is locked out is avoidable.
