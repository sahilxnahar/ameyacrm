#!/bin/sh
set -e
echo "▶ Applying database migrations…"
# F-15: fail closed — a failed migration must abort boot, not serve a drifted schema.
node node_modules/prisma/build/index.js migrate deploy
if [ "${SEED_ON_START}" = "true" ]; then
  echo "▶ Seeding database…"
  node node_modules/prisma/build/index.js db seed || echo "⚠ seed skipped"
fi
echo "▶ Starting Ameya Heights CRM…"
exec "$@"
