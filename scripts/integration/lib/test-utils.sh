#!/bin/bash
# Integration Test Utilities
# Source this file in test scripts: source "$(dirname "$0")/lib/test-utils.sh"

# ============================================
# Colors
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ============================================
# Counters
# ============================================
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ============================================
# Assertions
# ============================================

# Assert two values are equal
# Usage: assert_eq "$actual" "$expected" "description"
assert_eq() {
  local actual="$1"
  local expected="$2"
  local desc="$3"

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC}: $desc"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "  ${RED}FAIL${NC}: $desc"
    echo -e "       Expected: ${CYAN}$expected${NC}"
    echo -e "       Actual:   ${CYAN}$actual${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# Assert HTTP status code
# Usage: assert_http_status "$status_code" "$expected" "description"
assert_http_status() {
  assert_eq "$1" "$2" "$3 (HTTP $2)"
}

# Assert JSON field value
# Usage: assert_json_field "$json" ".field" "expected" "description"
assert_json_field() {
  local json="$1"
  local field="$2"
  local expected="$3"
  local desc="$4"
  local actual

  actual=$(echo "$json" | jq -r "$field" 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo -e "  ${RED}FAIL${NC}: $desc (invalid JSON or field)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi

  assert_eq "$actual" "$expected" "$desc"
}

# Assert JSON field exists and is not null/empty
# Usage: assert_json_exists "$json" ".field" "description"
assert_json_exists() {
  local json="$1"
  local field="$2"
  local desc="$3"
  local value

  value=$(echo "$json" | jq -r "$field" 2>/dev/null)
  if [ $? -ne 0 ] || [ "$value" = "null" ] || [ -z "$value" ]; then
    echo -e "  ${RED}FAIL${NC}: $desc (field missing or null)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi

  echo -e "  ${GREEN}PASS${NC}: $desc"
  PASS_COUNT=$((PASS_COUNT + 1))
  return 0
}

# Assert command succeeds (exit code 0)
# Usage: assert_success "command" "description"
assert_success() {
  local cmd="$1"
  local desc="$2"

  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}PASS${NC}: $desc"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "  ${RED}FAIL${NC}: $desc"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# Mark test as skipped
# Usage: skip_test "reason"
skip_test() {
  local reason="$1"
  echo -e "  ${YELLOW}SKIP${NC}: $reason"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ============================================
# HTTP Helpers
# ============================================

# Make HTTP request and capture status + body
# Usage: http_get "url" ["header1" "header2" ...]
# Returns: Sets HTTP_STATUS and HTTP_BODY globals
HTTP_STATUS=""
HTTP_BODY=""

http_get() {
  local url="$1"
  shift
  local headers=()

  for h in "$@"; do
    headers+=(-H "$h")
  done

  local response
  response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$url")
  HTTP_STATUS=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

http_post() {
  local url="$1"
  local data="$2"
  shift 2
  local headers=(-H "Content-Type: application/json")

  for h in "$@"; do
    headers+=(-H "$h")
  done

  local response
  response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X POST -d "$data" "$url")
  HTTP_STATUS=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

http_delete() {
  local url="$1"
  shift
  local headers=()

  for h in "$@"; do
    headers+=(-H "$h")
  done

  local response
  response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X DELETE "$url")
  HTTP_STATUS=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

# ============================================
# Timing
# ============================================
TEST_START_TIME=""

start_timer() {
  TEST_START_TIME=$(date +%s)
}

end_timer() {
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - TEST_START_TIME))
  echo -e "${CYAN}Duration: ${duration}s${NC}"
}

# ============================================
# Reporting
# ============================================

# Print section header
# Usage: section "Section Name"
section() {
  echo ""
  echo -e "${BOLD}${BLUE}=== $1 ===${NC}"
  echo ""
}

# Print test phase header
# Usage: phase "Phase N" "Description"
phase() {
  echo ""
  echo -e "${BOLD}----------------------------------------${NC}"
  echo -e "${BOLD}$1: $2${NC}"
  echo -e "${BOLD}----------------------------------------${NC}"
}

# Print final summary
report_summary() {
  local total=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

  echo ""
  echo -e "${BOLD}======================================${NC}"
  echo -e "${BOLD}         Test Summary${NC}"
  echo -e "${BOLD}======================================${NC}"
  echo -e "  Total:   $total"
  echo -e "  ${GREEN}Passed:  $PASS_COUNT${NC}"
  echo -e "  ${RED}Failed:  $FAIL_COUNT${NC}"
  echo -e "  ${YELLOW}Skipped: $SKIP_COUNT${NC}"
  echo -e "${BOLD}======================================${NC}"

  if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}RESULT: FAILED${NC}"
    return 1
  else
    echo -e "${GREEN}RESULT: PASSED${NC}"
    return 0
  fi
}

# ============================================
# Utilities
# ============================================

# Generate unique test ID (for emails, etc.)
generate_test_id() {
  echo "test-$(date +%s)-$$"
}

# Wait for condition with timeout
# Usage: wait_for "description" timeout_seconds "command"
wait_for() {
  local desc="$1"
  local timeout="$2"
  local cmd="$3"
  local elapsed=0
  local interval=2

  echo -n "  Waiting for $desc"

  while [ $elapsed -lt $timeout ]; do
    if eval "$cmd" > /dev/null 2>&1; then
      echo -e " ${GREEN}OK${NC} (${elapsed}s)"
      return 0
    fi
    echo -n "."
    sleep $interval
    elapsed=$((elapsed + interval))
  done

  echo -e " ${RED}TIMEOUT${NC} (${timeout}s)"
  return 1
}

# Check if command exists
require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}ERROR${NC}: Required command '$cmd' not found"
    return 1
  fi
  return 0
}
