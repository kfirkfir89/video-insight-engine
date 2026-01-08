FROM node:20-alpine AS builder

WORKDIR /app

# Copy all source files first
COPY packages/types/ packages/types/
COPY apps/web/ apps/web/

# Build the types package
RUN cd packages/types && npm install && npm run build

# Install and build web app
# Replace workspace reference with local path
RUN cd apps/web && sed -i 's/"@vie\/types": "workspace:\^"/"@vie\/types": "file:..\/..\/packages\/types"/' package.json && npm install && npm run build

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
