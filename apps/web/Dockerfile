FROM node:20-alpine AS builder

WORKDIR /app

# Build args for Vite (must be available at build time)
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_WS_URL=ws://localhost:3000
ARG VITE_ENABLE_DEV_LOGIN=true

# Make build args available as env vars for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_ENABLE_DEV_LOGIN=$VITE_ENABLE_DEV_LOGIN

# Copy all source files first
COPY packages/shared/ packages/shared/
COPY packages/types/ packages/types/
COPY apps/web/ apps/web/

# Build the shared package first (types depends on it)
RUN cd packages/shared && npm install && npm run build

# Build the types package
RUN cd packages/types && \
    sed -i 's/"@vie\/shared": "workspace:\*"/"@vie\/shared": "file:..\/shared"/' package.json && \
    npm install && npm run build

# Install and build web app
# Replace workspace references with local paths
RUN cd apps/web && \
    sed -i 's/"@vie\/types": "workspace:\^"/"@vie\/types": "file:..\/..\/packages\/types"/' package.json && \
    sed -i 's/"@vie\/shared": "workspace:\*"/"@vie\/shared": "file:..\/..\/packages\/shared"/' package.json && \
    npm install && npm run build

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
