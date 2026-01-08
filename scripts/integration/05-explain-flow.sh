#!/bin/bash
# Phase 5: Explain Flow Test
# SKIPPED: MCP integration not implemented - explain routes are stubs

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 5: Explain Flow"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  PHASE 5 SKIPPED - MCP NOT INTEGRATED  ${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "The explain routes in vie-api are currently stubs."
echo ""
echo "Location: api/src/routes/explain.routes.ts"
echo ""
echo "Current implementation returns:"
echo "  GET  /api/explain/:id/:type/:targetId"
echo "       -> { expansion: '# Coming soon\\n\\nMCP integration pending.' }"
echo ""
echo "  POST /api/explain/chat"
echo "       -> { response: 'Chat coming soon', chatId: 'stub' }"
echo ""
echo "Blocking issue:"
echo "  - MCP client needs to be implemented in vie-api"
echo "  - vie-api needs to connect to vie-explainer MCP server"
echo "  - This is a separate implementation task"
echo ""

# Optionally verify the stub still works
ACCESS_TOKEN=$(get_token)
VIDEO_SUMMARY_ID=$(cat /tmp/vie-test-summaryid.txt 2>/dev/null || echo "test-id")
SECTION_ID=$(cat /tmp/vie-test-sectionid.txt 2>/dev/null || echo "test-section")

if [ -n "$ACCESS_TOKEN" ] && [ "$VIDEO_SUMMARY_ID" != "null" ]; then
  echo "Verifying stub routes are accessible..."
  echo ""

  http_get "$API_BASE/explain/$VIDEO_SUMMARY_ID/section/$SECTION_ID" "Authorization: Bearer $ACCESS_TOKEN"

  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "  ${GREEN}PASS${NC}: Explain route is accessible (returns stub)"
    PASS_COUNT=$((PASS_COUNT + 1))

    EXPANSION=$(echo "$HTTP_BODY" | jq -r '.expansion' 2>/dev/null)
    if echo "$EXPANSION" | grep -q "Coming soon"; then
      echo -e "  ${GREEN}PASS${NC}: Returns expected stub response"
      PASS_COUNT=$((PASS_COUNT + 1))
    fi
  else
    echo -e "  ${YELLOW}INFO${NC}: Explain route returned $HTTP_STATUS"
  fi
fi

echo ""
echo -e "${YELLOW}Phase 5 marked as SKIPPED${NC}"
echo ""

# Mark entire phase as skipped
skip_test "Explain Flow - MCP integration not implemented"
skip_test "Section expansion - blocked by MCP"
skip_test "Concept expansion - blocked by MCP"
skip_test "Explain chat - blocked by MCP"
skip_test "Expansion caching - blocked by MCP"

# ============================================
# Summary (always passes since it's a known skip)
# ============================================
echo ""
echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}         Phase 5 Summary${NC}"
echo -e "${BOLD}======================================${NC}"
echo -e "  ${GREEN}Passed:  $PASS_COUNT${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP_COUNT${NC}"
echo -e "${BOLD}======================================${NC}"
echo -e "${YELLOW}RESULT: SKIPPED (not a failure)${NC}"

# Exit 0 - skip is not failure
exit 0
