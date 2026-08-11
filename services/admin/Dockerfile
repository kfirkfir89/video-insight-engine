# Stage 1: Build React UI
FROM node:20-slim AS ui-builder
WORKDIR /ui
COPY services/admin/ui/package*.json ./
RUN npm ci
COPY services/admin/ui/ ./
RUN npm run build

# Stage 2: Python backend + static files
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies from the uv-compiled lockfile (reproducible
# builds — regenerate with the command in the lockfile header).
COPY services/admin/requirements.lock .
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.lock

# Copy backend source
COPY services/admin/src/ ./src/

# Copy built React UI from stage 1 (vite outputs to ../static relative to /ui)
COPY --from=ui-builder /ui/../static ./static/

# Non-root runtime user — the service only reads /app at runtime.
RUN useradd --create-home --uid 10001 app
USER app
ENV HOME=/home/app

EXPOSE 8002

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]
