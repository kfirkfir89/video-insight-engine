#!/bin/bash
# Phase 2: Health Checks
# Verifies all service health endpoints respond correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 2: Health Checks"

# ============================================
# vie-api
# ============================================
phase "2.1" "vie-api Health Check"

http_get "$API_URL/health"
assert_http_status "$HTTP_STATUS" "200" "vie-api /health returns 200"
assert_json_field "$HTTP_BODY" ".status" "ok" "vie-api status is 'ok'"
assert_json_exists "$HTTP_BODY" ".timestamp" "vie-api returns timestamp"

# ============================================
# vie-summarizer
# ============================================
phase "2.2" "vie-summarizer Health Check"

http_get "$SUMMARIZER_URL/health"
assert_http_status "$HTTP_STATUS" "200" "vie-summarizer /health returns 200"
assert_json_field "$HTTP_BODY" ".status" "healthy" "vie-summarizer status is 'healthy'"
assert_json_field "$HTTP_BODY" ".service" "vie-summarizer" "vie-summarizer service name"
assert_json_exists "$HTTP_BODY" ".model" "vie-summarizer returns model info"

# Also check root endpoint
http_get "$SUMMARIZER_URL/"
assert_http_status "$HTTP_STATUS" "200" "vie-summarizer / returns 200"
assert_json_field "$HTTP_BODY" ".service" "vie-summarizer" "vie-summarizer root identifies service"

# ============================================
# vie-explainer
# ============================================
phase "2.3" "vie-explainer Status Check"

# vie-explainer uses MCP protocol (stdio), not HTTP
# We can only verify the container is running
cd "$PROJECT_ROOT"

if docker-compose ps vie-explainer 2>/dev/null | grep -q "Up"; then
  echo -e "  ${GREEN}PASS${NC}: vie-explainer container is running"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: vie-explainer container is not running"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check container logs for startup errors
EXPLAINER_ERRORS=$(docker-compose logs vie-explainer 2>&1 | grep -i "error\|exception\|traceback" | head -5)
if [ -z "$EXPLAINER_ERRORS" ]; then
  echo -e "  ${GREEN}PASS${NC}: vie-explainer has no startup errors"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: vie-explainer has potential issues in logs:"
  echo "$EXPLAINER_ERRORS" | sed 's/^/       /'
fi

# ============================================
# vie-mongodb
# ============================================
phase "2.4" "vie-mongodb Health Check"

# Use docker exec to check MongoDB
MONGO_PING=$(docker-compose exec -T vie-mongodb mongosh --eval "db.runCommand('ping')" --quiet 2>/dev/null || echo "failed")

if echo "$MONGO_PING" | grep -q 'ok.*1'; then
  echo -e "  ${GREEN}PASS${NC}: MongoDB ping successful"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: MongoDB ping failed"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check indexes exist
INDEX_CHECK=$(docker-compose exec -T vie-mongodb mongosh video-insight-engine --eval "db.videoSummaryCache.getIndexes().length" --quiet 2>/dev/null || echo "0")

if [ "$INDEX_CHECK" -gt "1" ]; then
  echo -e "  ${GREEN}PASS${NC}: MongoDB indexes exist (found $INDEX_CHECK)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: MongoDB indexes may not be set up (run scripts/setup-mongo.js)"
fi

# ============================================
# vie-web
# ============================================
phase "2.5" "vie-web Health Check"

http_get "$WEB_URL"
assert_http_status "$HTTP_STATUS" "200" "vie-web returns 200"

# Check that response contains expected HTML
if echo "$HTTP_BODY" | grep -q "<html"; then
  echo -e "  ${GREEN}PASS${NC}: vie-web returns HTML"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: vie-web does not return HTML"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check for React app mount point
if echo "$HTTP_BODY" | grep -q 'id="root"'; then
  echo -e "  ${GREEN}PASS${NC}: vie-web has React mount point"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: vie-web missing React mount point"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ============================================
# Cross-service connectivity
# ============================================
phase "2.6" "Cross-Service Connectivity"

# Test that vie-api can reach vie-summarizer (internal network)
# This is implicit in the later tests, but we can verify logs
API_LOGS=$(docker-compose logs vie-api 2>&1 | tail -20)

if echo "$API_LOGS" | grep -qi "error\|fatal"; then
  echo -e "  ${YELLOW}WARN${NC}: vie-api logs contain error messages"
else
  echo -e "  ${GREEN}PASS${NC}: vie-api logs clean"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# ============================================
# Summary
# ============================================
report_summary
