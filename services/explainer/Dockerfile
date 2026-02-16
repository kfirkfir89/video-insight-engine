FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Run MCP server via Starlette
CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8001"]
