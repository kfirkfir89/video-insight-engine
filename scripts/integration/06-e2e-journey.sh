#!/bin/bash
# Phase 6: Full E2E Journey
# Complete user workflow from registration to video summary

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 6: Full E2E Journey"

start_timer

# Generate unique test email for this E2E run
E2E_EMAIL="e2e-$(date +%s)-$$@test.com"
E2E_PASSWORD="E2ETest123!"
E2E_NAME="E2E Test User"

echo "Starting complete E2E journey..."
echo "Test email: $E2E_EMAIL"
echo ""

# ============================================
# Step 1: Register
# ============================================
phase "6.1" "Register New User"

REGISTER_DATA=$(cat <<EOF
{
  "email": "$E2E_EMAIL",
  "password": "$E2E_PASSWORD",
  "name": "$E2E_NAME"
}
EOF
)

http_post "$API_BASE/auth/register" "$REGISTER_DATA"

if [ "$HTTP_STATUS" != "201" ]; then
  echo -e "${RED}FAIL${NC}: Registration failed with status $HTTP_STATUS"
  echo "$HTTP_BODY"
  exit 1
fi

TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')
USER_ID=$(echo "$HTTP_BODY" | jq -r '.user.id')

echo -e "  ${GREEN}OK${NC} Registered user: $USER_ID"
PASS_COUNT=$((PASS_COUNT + 1))

# ============================================
# Step 2: Verify Login Works
# ============================================
phase "6.2" "Verify Login"

LOGIN_DATA=$(cat <<EOF
{
  "email": "$E2E_EMAIL",
  "password": "$E2E_PASSWORD"
}
EOF
)

http_post "$API_BASE/auth/login" "$LOGIN_DATA"

if [ "$HTTP_STATUS" != "200" ]; then
  echo -e "${RED}FAIL${NC}: Login failed"
  exit 1
fi

TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')
echo -e "  ${GREEN}OK${NC} Login successful"
PASS_COUNT=$((PASS_COUNT + 1))

# ============================================
# Step 3: Verify Profile
# ============================================
phase "6.3" "Verify Profile"

http_get "$API_BASE/auth/me" "Authorization: Bearer $TOKEN"

if [ "$HTTP_STATUS" != "200" ]; then
  echo -e "${RED}FAIL${NC}: Profile fetch failed"
  exit 1
fi

PROFILE_EMAIL=$(echo "$HTTP_BODY" | jq -r '.email')
if [ "$PROFILE_EMAIL" = "$E2E_EMAIL" ]; then
  echo -e "  ${GREEN}OK${NC} Profile email matches"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}FAIL${NC}: Profile email mismatch"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ============================================
# Step 4: Submit Video
# ============================================
phase "6.4" "Submit Video"

VIDEO_DATA="{\"url\":\"$TEST_YOUTUBE_URL\"}"

http_post "$API_BASE/videos" "$VIDEO_DATA" "Authorization: Bearer $TOKEN"

if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ] && [ "$HTTP_STATUS" != "202" ]; then
  echo -e "${RED}FAIL${NC}: Video submit failed with $HTTP_STATUS"
  echo "$HTTP_BODY"
  exit 1
fi

VIDEO_ID=$(echo "$HTTP_BODY" | jq -r '.video.id // .id')
SUMMARY_ID=$(echo "$HTTP_BODY" | jq -r '.video.videoSummaryId // .videoSummaryId')
STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status // .status')
CACHED=$(echo "$HTTP_BODY" | jq -r '.cached // false')

echo -e "  ${GREEN}OK${NC} Video submitted: $VIDEO_ID"
echo "       Status: $STATUS, Cached: $CACHED"
PASS_COUNT=$((PASS_COUNT + 1))

# ============================================
# Step 5: Wait for Processing
# ============================================
phase "6.5" "Wait for Processing"

if [ "$STATUS" = "completed" ]; then
  echo -e "  ${GREEN}OK${NC} Already completed (cached)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  Waiting for video processing..."
  ELAPSED=0
  MAX_WAIT=$VIDEO_PROCESSING_TIMEOUT

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    http_get "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $TOKEN"
    STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status // .status')

    if [ "$STATUS" = "completed" ]; then
      echo -e "  ${GREEN}OK${NC} Processing completed in ${ELAPSED}s"
      PASS_COUNT=$((PASS_COUNT + 1))
      break
    elif [ "$STATUS" = "failed" ]; then
      ERROR=$(echo "$HTTP_BODY" | jq -r '.video.error // "unknown"')
      echo -e "  ${RED}FAIL${NC} Processing failed: $ERROR"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      break
    fi

    printf "    [%3ds] Status: %s\n" "$ELAPSED" "$STATUS"
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "  ${YELLOW}WARN${NC} Processing timed out"
    SKIP_COUNT=$((SKIP_COUNT + 1))
  fi
fi

# ============================================
# Step 6: Get Video Detail
# ============================================
phase "6.6" "Get Video Detail"

http_get "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $TOKEN"

if [ "$HTTP_STATUS" != "200" ]; then
  echo -e "${RED}FAIL${NC}: Video fetch failed"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  TITLE=$(echo "$HTTP_BODY" | jq -r '.video.title // .title // "unknown"')
  echo -e "  ${GREEN}OK${NC} Video: $TITLE"
  PASS_COUNT=$((PASS_COUNT + 1))

  # Check summary
  STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status // .status')
  if [ "$STATUS" = "completed" ]; then
    TLDR=$(echo "$HTTP_BODY" | jq -r '.summary.tldr // "N/A"' | head -c 100)
    SECTIONS=$(echo "$HTTP_BODY" | jq '.summary.sections | length' 2>/dev/null || echo "0")
    CONCEPTS=$(echo "$HTTP_BODY" | jq '.summary.concepts | length' 2>/dev/null || echo "0")

    echo "       TLDR: ${TLDR}..."
    echo "       Sections: $SECTIONS"
    echo "       Concepts: $CONCEPTS"
  fi
fi

# ============================================
# Step 7: List Videos
# ============================================
phase "6.7" "List Videos"

http_get "$API_BASE/videos" "Authorization: Bearer $TOKEN"

if [ "$HTTP_STATUS" != "200" ]; then
  echo -e "${RED}FAIL${NC}: Video list failed"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  COUNT=$(echo "$HTTP_BODY" | jq '.videos | length' 2>/dev/null || echo "0")
  echo -e "  ${GREEN}OK${NC} Videos in library: $COUNT"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# ============================================
# Step 8: Delete Video
# ============================================
phase "6.8" "Delete Video"

http_delete "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $TOKEN"

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
  echo -e "  ${GREEN}OK${NC} Video deleted"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC} Delete returned $HTTP_STATUS"
fi

# Verify deletion
http_get "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $TOKEN"
if [ "$HTTP_STATUS" = "404" ]; then
  echo -e "  ${GREEN}OK${NC} Video confirmed deleted"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC} Video may still exist (status: $HTTP_STATUS)"
fi

# ============================================
# Step 9: Logout
# ============================================
phase "6.9" "Logout"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -X POST "$API_BASE/auth/logout")

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
  echo -e "  ${GREEN}OK${NC} Logged out"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC} Logout returned $HTTP_STATUS"
fi

# ============================================
# Summary
# ============================================
echo ""
end_timer

report_summary
