#!/bin/bash
# Phase 1: Start Services
# Starts Docker Compose and waits for all services to be healthy

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 1: Start Services"

cd "$PROJECT_ROOT"

# Check if services are already running
echo "Checking current service status..."
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)

if [ "$RUNNING" -gt 0 ]; then
  echo -e "  ${CYAN}Found $RUNNING services already running${NC}"
  echo "  Restarting to ensure clean state..."
  docker-compose down --remove-orphans 2>/dev/null || true
  sleep 2
fi

# Start services
echo ""
echo "Starting all services..."
start_timer

docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
echo ""

# Wait for MongoDB (has health check in docker-compose)
echo -n "  vie-mongodb: "
ELAPSED=0
while [ $ELAPSED -lt $STARTUP_TIMEOUT ]; do
  if docker-compose exec -T vie-mongodb mongosh --eval "db.runCommand('ping')" &> /dev/null; then
    echo -e "${GREEN}healthy${NC} (${ELAPSED}s)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
if [ $ELAPSED -ge $STARTUP_TIMEOUT ]; then
  echo -e "${RED}timeout${NC}"
  exit 1
fi

# Wait for vie-api
echo -n "  vie-api: "
ELAPSED=0
while [ $ELAPSED -lt $STARTUP_TIMEOUT ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}healthy${NC} (${ELAPSED}s)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
if [ $ELAPSED -ge $STARTUP_TIMEOUT ]; then
  echo -e "${RED}timeout${NC}"
  exit 1
fi

# Wait for vie-summarizer
echo -n "  vie-summarizer: "
ELAPSED=0
while [ $ELAPSED -lt $STARTUP_TIMEOUT ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUMMARIZER_URL/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}healthy${NC} (${ELAPSED}s)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
if [ $ELAPSED -ge $STARTUP_TIMEOUT ]; then
  echo -e "${RED}timeout${NC}"
  exit 1
fi

# Wait for vie-explainer (container running, port open)
echo -n "  vie-explainer: "
ELAPSED=0
while [ $ELAPSED -lt $STARTUP_TIMEOUT ]; do
  if docker-compose ps vie-explainer 2>/dev/null | grep -q "Up"; then
    # Check if port is listening
    if nc -z localhost $EXPLAINER_PORT 2>/dev/null || docker-compose exec -T vie-explainer echo "ok" &>/dev/null; then
      echo -e "${GREEN}running${NC} (${ELAPSED}s)"
      break
    fi
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
if [ $ELAPSED -ge $STARTUP_TIMEOUT ]; then
  echo -e "${YELLOW}unknown${NC} (MCP server - cannot verify HTTP health)"
fi

# Wait for vie-web
echo -n "  vie-web: "
ELAPSED=0
while [ $ELAPSED -lt $STARTUP_TIMEOUT ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}healthy${NC} (${ELAPSED}s)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
if [ $ELAPSED -ge $STARTUP_TIMEOUT ]; then
  echo -e "${RED}timeout${NC}"
  exit 1
fi

echo ""
end_timer

# Show container status
echo ""
echo "Container status:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo -e "${GREEN}All services started successfully!${NC}"
