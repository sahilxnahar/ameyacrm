#!/bin/sh
set -e
echo "▶ Applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy || echo "⚠ migrate deploy skipped/failed (continuing)"
if [ "${SEED_ON_START}" = "true" ]; then
  echo "▶ Seeding database…"
  node node_modules/prisma/build/index.js db seed || echo "⚠ seed skipped"
fi
echo "▶ Starting Ameya Heights CRM…"
exec "$@"
