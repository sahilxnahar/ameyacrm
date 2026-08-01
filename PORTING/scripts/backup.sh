#!/usr/bin/env bash
# Take a compressed backup of the CRM database.
#   ./backup.sh                → into ./backups
#   ./backup.sh /mnt/somewhere → into that folder
set -euo pipefail

DEST="${1:-./backups}"
mkdir -p "$DEST"

: "${DATABASE_URL_UNPOOLED:?Set DATABASE_URL_UNPOOLED first (the DIRECT connection string, not the pooled one)}"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$DEST/ameya-backup-$STAMP.dump"

echo "Backing up to $FILE …"
pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "Done — $SIZE"

# Keep the last 14. Old backups you never prune quietly fill the disk, and a
# full disk is its own outage.
ls -1t "$DEST"/ameya-backup-*.dump 2>/dev/null | tail -n +15 | while read -r old; do
  echo "Removing old backup: $old"
  rm -f "$old"
done

echo
echo "Restore with:"
echo "  pg_restore --clean --if-exists -d \"\$DATABASE_URL_UNPOOLED\" $FILE"
