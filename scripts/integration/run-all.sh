#!/bin/bash
# Integration Test Runner
# Executes all integration test phases in sequence

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

# ============================================
# Header
# ============================================
echo ""
echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}    Video Insight Engine - Integration Tests${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"
echo ""
echo "Started: $(date)"
echo "Project: $PROJECT_ROOT"
echo ""

TOTAL_START=$(date +%s)

# Track results
declare -a PHASE_RESULTS
PHASES_PASSED=0
PHASES_FAILED=0
PHASES_SKIPPED=0

# ============================================
# Run a test phase
# ============================================
run_phase() {
  local script="$1"
  local name="$2"
  local phase_num="$3"

  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${BLUE}  Phase $phase_num: $name${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  local start_time=$(date +%s)
  local exit_code=0

  # Run the script
  if "$SCRIPT_DIR/$script"; then
    exit_code=0
  else
    exit_code=$?
  fi

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Record result
  if [ $exit_code -eq 0 ]; then
    PHASE_RESULTS+=("${GREEN}PASS${NC} Phase $phase_num: $name (${duration}s)")
    PHASES_PASSED=$((PHASES_PASSED + 1))
  else
    PHASE_RESULTS+=("${RED}FAIL${NC} Phase $phase_num: $name (exit $exit_code)")
    PHASES_FAILED=$((PHASES_FAILED + 1))
  fi

  return $exit_code
}

# ============================================
# Run Node.js test
# ============================================
run_node_phase() {
  local script="$1"
  local name="$2"
  local phase_num="$3"

  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${BLUE}  Phase $phase_num: $name${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  local start_time=$(date +%s)
  local exit_code=0

  # Run the Node.js script
  if node "$SCRIPT_DIR/$script"; then
    exit_code=0
  else
    exit_code=$?
  fi

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Record result
  if [ $exit_code -eq 0 ]; then
    PHASE_RESULTS+=("${GREEN}PASS${NC} Phase $phase_num: $name (${duration}s)")
    PHASES_PASSED=$((PHASES_PASSED + 1))
  else
    PHASE_RESULTS+=("${RED}FAIL${NC} Phase $phase_num: $name (exit $exit_code)")
    PHASES_FAILED=$((PHASES_FAILED + 1))
  fi

  return $exit_code
}

# ============================================
# Parse Arguments
# ============================================
SKIP_START=false
SKIP_CLEANUP=false
STOP_AFTER=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-start)
      SKIP_START=true
      shift
      ;;
    --skip-cleanup)
      SKIP_CLEANUP=true
      shift
      ;;
    --stop-after)
      STOP_AFTER=true
      shift
      ;;
    --phase)
      # Run single phase
      SINGLE_PHASE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-start    Skip service startup (assume already running)"
      echo "  --skip-cleanup  Skip cleanup phase"
      echo "  --stop-after    Stop services after tests"
      echo "  --phase N       Run only phase N (0-7)"
      echo "  -h              Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ============================================
# Execute Phases
# ============================================

# Phase 0: Prerequisites
if ! run_phase "00-check-prereqs.sh" "Prerequisites Check" "0"; then
  echo ""
  echo -e "${RED}Prerequisites check failed. Cannot continue.${NC}"
  exit 1
fi

# Phase 1: Start Services
if ! $SKIP_START; then
  if ! run_phase "01-start-services.sh" "Start Services" "1"; then
    echo ""
    echo -e "${RED}Service startup failed. Cannot continue.${NC}"
    exit 1
  fi
else
  echo ""
  echo -e "${YELLOW}Skipping service startup (--skip-start)${NC}"
  PHASE_RESULTS+=("${YELLOW}SKIP${NC} Phase 1: Start Services")
  PHASES_SKIPPED=$((PHASES_SKIPPED + 1))
fi

# Phase 2: Health Checks
run_phase "02-health-check.sh" "Health Checks" "2" || true

# Phase 3: Auth Flow
run_phase "03-auth-flow.sh" "Authentication Flow" "3" || true

# Phase 4: Video Flow
run_phase "04-video-flow.sh" "Video Flow" "4" || true

# Phase 5: Explain Flow (Skip)
run_phase "05-explain-flow.sh" "Explain Flow (STUB)" "5" || true

# Phase 6: E2E Journey
run_phase "06-e2e-journey.sh" "E2E Journey" "6" || true

# Phase 7: WebSocket Tests
run_node_phase "07-ws-test.js" "WebSocket Tests" "7" || true

# Phase 8: Cleanup
if ! $SKIP_CLEANUP; then
  if $STOP_AFTER; then
    "$SCRIPT_DIR/08-cleanup.sh" --stop
  else
    "$SCRIPT_DIR/08-cleanup.sh"
  fi
  PHASE_RESULTS+=("${GREEN}PASS${NC} Phase 8: Cleanup")
  PHASES_PASSED=$((PHASES_PASSED + 1))
else
  echo ""
  echo -e "${YELLOW}Skipping cleanup (--skip-cleanup)${NC}"
  PHASE_RESULTS+=("${YELLOW}SKIP${NC} Phase 8: Cleanup")
  PHASES_SKIPPED=$((PHASES_SKIPPED + 1))
fi

# ============================================
# Final Summary
# ============================================
TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

echo ""
echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}                    FINAL SUMMARY${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"
echo ""

echo "Phase Results:"
for result in "${PHASE_RESULTS[@]}"; do
  echo -e "  $result"
done

echo ""
echo "----------------------------------------"
echo -e "  Phases Passed:  ${GREEN}$PHASES_PASSED${NC}"
echo -e "  Phases Failed:  ${RED}$PHASES_FAILED${NC}"
echo -e "  Phases Skipped: ${YELLOW}$PHASES_SKIPPED${NC}"
echo "----------------------------------------"
echo "  Total Duration: ${TOTAL_DURATION}s"
echo "----------------------------------------"
echo ""

if [ $PHASES_FAILED -gt 0 ]; then
  echo -e "${BOLD}${RED}INTEGRATION TESTS: FAILED${NC}"
  exit 1
else
  echo -e "${BOLD}${GREEN}INTEGRATION TESTS: PASSED${NC}"
  exit 0
fi
