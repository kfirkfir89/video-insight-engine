FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies from the uv-compiled lockfile (reproducible
# builds — regenerate with the command in the lockfile header). The lock pins
# torch==<ver>+cpu, whose wheel only exists on the PyTorch CPU index; the
# default PyPI wheel would bundle ~1.5GB of CUDA libraries this CPU-only
# embedding service never uses. --timeout/--retries harden the large
# downloads against transient read timeouts.
COPY services/assistant/requirements.lock .
RUN pip install --no-cache-dir --timeout 120 --retries 5 \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.lock

# Install shared llm-common package. --no-deps: its dependency tree is already
# pinned by requirements.lock (compiled from requirements.txt + the package's
# own pyproject.toml), so resolving again would bypass the lock.
COPY packages/llm-common/ /tmp/llm-common/
RUN pip install --no-cache-dir --no-deps /tmp/llm-common/ && rm -rf /tmp/llm-common/

# Non-root runtime user with a writable HOME for runtime model caches
# (sentence-transformers downloads embeddings models on first use).
RUN useradd --create-home --uid 10001 app && chown -R app:app /app

# Copy source
COPY --chown=app:app services/assistant/src/ ./src/

USER app
ENV HOME=/home/app

# Run assistant server
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8001"]
