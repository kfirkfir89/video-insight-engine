FROM python:3.11-slim

WORKDIR /app

# Install shared llm-common package
COPY packages/llm-common/ /tmp/llm-common/
RUN pip install --no-cache-dir /tmp/llm-common/ && rm -rf /tmp/llm-common/

# Install dependencies
COPY services/explainer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY services/explainer/src/ ./src/

# Run MCP server via Starlette
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8001"]
