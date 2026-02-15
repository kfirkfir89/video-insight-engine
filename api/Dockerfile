# ----------------------------
# Stage 1: Builder
# ----------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.11.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types ./packages/types
COPY api ./api

# Scoped install (only API + workspace deps)
RUN pnpm install --frozen-lockfile --filter @vie/api...

# Build types first, then API
RUN pnpm --filter @vie/types build && pnpm --filter @vie/api build

# Clean production bundle
RUN pnpm --filter @vie/api deploy --prod /prod/api

# ----------------------------
# Stage 2: Production
# ----------------------------
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /prod/api/dist ./dist
COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /prod/api/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
