FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (ffmpeg for Whisper, nodejs for yt-dlp JS challenges, tesseract for OCR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install shared llm-common package
COPY packages/llm-common/ /tmp/llm-common/
RUN pip install --no-cache-dir /tmp/llm-common/ && rm -rf /tmp/llm-common/

# Install Python dependencies.
# sentence-transformers pulls torch, whose default PyPI wheel bundles ~1.5GB of
# CUDA libraries (nvidia-*, triton) this CPU-only service never uses — they bloat
# the image and the large downloads time out on slow networks. Install the
# CPU-only torch wheel FIRST (PyTorch CPU index, PyPI as extra for torch's
# pure-python deps) so the requirements below resolve against it.
COPY services/summarizer/requirements.txt .
RUN pip install --no-cache-dir --timeout 120 --retries 5 \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple \
        torch \
 && pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt

# Download spaCy model for sentence segmentation
RUN python -m spacy download en_core_web_sm

# Create frame storage directory
RUN mkdir -p storage/frames

# Copy source
COPY services/summarizer/src/ ./src/

# Health endpoint
EXPOSE 8000

# Run FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
