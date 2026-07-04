# Tenant app image — ONE image for every tenant; per-tenant differences are
# environment/config only (non-negotiables #1–2). Build from repo root:
#   docker build -f docker/app.Dockerfile -t hr-app:dev .
FROM node:22-alpine AS builder
WORKDIR /repo

# Install with the full workspace manifest set for layer caching
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/marketing/package.json apps/marketing/
COPY apps/admin/package.json apps/admin/
COPY services/provisioner/package.json services/provisioner/
COPY packages/design-system/package.json packages/design-system/
COPY packages/db/package.json packages/db/
COPY packages/entitlements/package.json packages/entitlements/
COPY packages/rbac/package.json packages/rbac/
COPY packages/schema-engine/package.json packages/schema-engine/
COPY packages/tenant-context/package.json packages/tenant-context/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/app ./apps/app
RUN npm run build --workspace app

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /repo/apps/app/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=app:app /repo/apps/app/public ./apps/app/public
USER app
EXPOSE 3000
CMD ["node", "apps/app/server.js"]
