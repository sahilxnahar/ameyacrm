# Backup, Restore & Disaster Recovery

Two stateful stores must be protected: **PostgreSQL** (all business data) and **object
storage** (uploaded files). Everything else is stateless and rebuilt from the image.

## Backup

### PostgreSQL (daily + before every deploy)

```bash
# Logical backup (compressed custom format)
pg_dump --format=custom --no-owner "$DATABASE_URL" \
  > backups/ameya_$(date +%F_%H%M).dump

# Docker Compose
docker compose exec -T db pg_dump -U ameya -F c ameya_crm \
  > backups/ameya_$(date +%F_%H%M).dump
```

Automate via cron/systemd timer; retain **daily 14 days, weekly 8 weeks, monthly 12
months**. For managed Postgres (Neon/Supabase/RDS), enable **PITR / automated snapshots**.

### Object storage (files)

- **AWS S3 / R2:** enable **versioning** + lifecycle rules; optionally cross‑region
  replication. Files are immutable once written (new versions get new keys).
- **MinIO (self‑host):** `mc mirror --overwrite local/ameya-crm s3remote/ameya-crm-backup`
  on a schedule, or replicate to a second MinIO/S3.

### Secrets

Back up `.env` / secret‑manager entries **out‑of‑band** (a password manager or vault).
`ENCRYPTION_KEY` is required to read stored TOTP secrets — losing it forces every user to
re‑enrol 2FA.

## Restore

```bash
# 1) Recreate database and restore
createdb ameya_crm
pg_restore --clean --no-owner --dbname "$DATABASE_URL" backups/ameya_<ts>.dump

# 2) Restore files (if lost)
mc mirror --overwrite s3remote/ameya-crm-backup local/ameya-crm

# 3) Bring the app up (migrations are idempotent)
docker compose up -d
curl -f http://localhost:3000/api/health
```

Always **test restores** quarterly into a scratch environment — an untested backup is a
hope, not a plan.

## Disaster Recovery plan

**Objectives:** RPO ≤ 24 h (≤ 5 min with PITR), RTO ≤ 2 h.

| Scenario | Response |
|---|---|
| App/container failure | Compose/orchestrator restarts; healthcheck gates traffic |
| DB corruption / bad deploy | Restore latest dump (or PITR to just before the event); re‑deploy previous image tag |
| Storage loss | Restore from versioned bucket / replica mirror |
| Region outage | Re‑deploy image in a second region; restore DB from snapshot; repoint DNS |
| Secret leak | Rotate `SESSION_SECRET` (logs everyone out), rotate storage/email keys, rotate DB creds; audit `AuditLog` |
| Ransomware/tamper | Immutable, versioned backups + offline copy enable clean rebuild; audit log aids scoping |

**Runbook:** 1) declare incident & assign lead → 2) stop writes if data‑integrity risk →
3) provision infra → 4) restore DB then files → 5) `migrate deploy` → 6) health + smoke test
(login, create task, upload) → 7) repoint traffic → 8) post‑mortem.

## Monitoring & alerting (recommended)

Uptime probe on `/api/health`; alerts on DB connection errors, disk/bucket capacity, failed
backups, and spikes in failed logins (from `LoginHistory`).
