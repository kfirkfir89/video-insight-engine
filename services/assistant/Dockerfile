FROM python:3.12-slim

WORKDIR /app

# Install shared llm-common package
COPY packages/llm-common/ /tmp/llm-common/
RUN pip install --no-cache-dir /tmp/llm-common/ && rm -rf /tmp/llm-common/

# Install dependencies.
# sentence-transformers pulls torch, whose default PyPI wheel bundles ~1.5GB of
# CUDA libraries (nvidia-*, triton) this CPU-only embedding service never uses —
# they bloat the image and the large downloads time out on slow networks. Install
# the CPU-only torch wheel FIRST (from the PyTorch CPU index, with PyPI as the
# extra index for torch's pure-python deps) so the requirements below resolve
# against it instead of the CUDA build. --timeout/--retries harden the remaining
# downloads against transient read timeouts.
COPY services/assistant/requirements.txt .
RUN pip install --no-cache-dir --timeout 120 --retries 5 \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple \
        torch \
 && pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt

# Copy source
COPY services/assistant/src/ ./src/

# Run assistant server
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8001"]
