# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# everything (incl. node_modules with drizzle-kit/tsx for migrate+seed) comes from build stage
COPY --from=build /app /app

RUN mkdir -p /app/data/uploads && addgroup -S app && adduser -S app -G app \
  && chown -R app:app /app/data
USER app

EXPOSE 3000

# 1) apply DB migrations (idempotent)
# 2) seed demo data (no-op if users already exist; set SEED_DEMO_PASSWORD to change demo password)
# 3) start server
CMD ["sh", "-c", "npx drizzle-kit migrate && (npx tsx db/seed.ts || true) && node dist/boot.js"]
