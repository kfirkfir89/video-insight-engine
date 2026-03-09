FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (ffmpeg for Whisper, nodejs for yt-dlp JS challenges)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install shared llm-common package
COPY packages/llm-common/ /tmp/llm-common/
RUN pip install --no-cache-dir /tmp/llm-common/ && rm -rf /tmp/llm-common/

# Install Python dependencies
COPY services/summarizer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY services/summarizer/src/ ./src/

# Health endpoint
EXPOSE 8000

# Run FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
