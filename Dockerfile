# ─── Ameya Heights CRM — multi-stage production image ───────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 1) Dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# 2) Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder secrets so `next build` can evaluate server modules. Real secrets
# are injected at runtime via the environment — never baked into the image.
ENV NODE_ENV=production \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    SESSION_SECRET="build-time-placeholder-session-secret-000000000000" \
    ENCRYPTION_KEY="build-time-placeholder-encryption-key-00000000000000"
RUN npx prisma generate && npm run build

# 3) Runtime
FROM base AS runner
# Everyone using this product is in India, and the server is the thing that
# decides what "today" means — for the FY boundary, the MSME 45-day clock, the
# statutory registers and every displayed timestamp. Left unset the container
# runs UTC, which put evening entries on the previous date.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 TZ=Asia/Kolkata
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma schema, migrations & engine for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
