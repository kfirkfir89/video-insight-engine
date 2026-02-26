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

# Install Python dependencies
COPY services/admin/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY services/admin/src/ ./src/

# Copy built React UI from stage 1
COPY --from=ui-builder /ui/../static ./static/

EXPOSE 8002

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]
