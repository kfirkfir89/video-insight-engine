FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8 --activate

WORKDIR /app

# Copy workspace root files for pnpm workspace resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy the types package (workspace dependency)
COPY packages/types ./packages/types

# Copy api package
COPY api ./api

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build types first, then api
RUN pnpm --filter @vie/types build && pnpm --filter @vie/api build

# Create production deployment bundle
RUN pnpm --filter @vie/api deploy --prod /prod/api

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /prod/api/dist ./dist
COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /prod/api/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
