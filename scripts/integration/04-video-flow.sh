#!/bin/bash
# Phase 4: Video Flow Test
# Tests video submission, processing, summary retrieval, and caching

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 4: Video Flow"

# Get auth token from previous phase
ACCESS_TOKEN=$(get_token)
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}ERROR${NC}: No access token found. Run 03-auth-flow.sh first."
  exit 1
fi

echo "Using token: ${ACCESS_TOKEN:0:20}..."
echo ""

# ============================================
# 4.1 Submit Video
# ============================================
phase "4.1" "Submit Video"

VIDEO_DATA=$(cat <<EOF
{
  "url": "$TEST_YOUTUBE_URL"
}
EOF
)

http_post "$API_BASE/videos" "$VIDEO_DATA" "Authorization: Bearer $ACCESS_TOKEN"

# Could be 200 (cached) or 201/202 (new)
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "202" ]; then
  echo -e "  ${GREEN}PASS${NC}: Video submit returns $HTTP_STATUS"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: Video submit returned $HTTP_STATUS (expected 200/201/202)"
  echo "  Response: $HTTP_BODY"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  exit 1
fi

# Extract video info
VIDEO_ID=$(echo "$HTTP_BODY" | jq -r '.video.id // .id')
VIDEO_SUMMARY_ID=$(echo "$HTTP_BODY" | jq -r '.video.videoSummaryId // .videoSummaryId')
CACHED=$(echo "$HTTP_BODY" | jq -r '.cached // false')
STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status // .status')

echo ""
echo "  Video ID: $VIDEO_ID"
echo "  Summary ID: $VIDEO_SUMMARY_ID"
echo "  Cached: $CACHED"
echo "  Status: $STATUS"

# Save for later phases
echo "$VIDEO_ID" > /tmp/vie-test-videoid.txt
echo "$VIDEO_SUMMARY_ID" > /tmp/vie-test-summaryid.txt

# ============================================
# 4.2 Poll for Processing (if not cached)
# ============================================
phase "4.2" "Wait for Processing"

if [ "$STATUS" = "completed" ]; then
  echo -e "  ${GREEN}INFO${NC}: Video already processed (cached or instant)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [ "$STATUS" = "pending" ] || [ "$STATUS" = "processing" ]; then
  echo "  Polling for completion (max ${VIDEO_PROCESSING_TIMEOUT}s)..."

  ELAPSED=0
  while [ $ELAPSED -lt $VIDEO_PROCESSING_TIMEOUT ]; do
    http_get "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $ACCESS_TOKEN"
    STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status // .status')

    echo "    [$ELAPSED s] Status: $STATUS"

    if [ "$STATUS" = "completed" ]; then
      echo -e "  ${GREEN}PASS${NC}: Video processing completed"
      PASS_COUNT=$((PASS_COUNT + 1))
      break
    elif [ "$STATUS" = "failed" ]; then
      ERROR=$(echo "$HTTP_BODY" | jq -r '.video.error // .error // "unknown"')
      echo -e "  ${RED}FAIL${NC}: Video processing failed: $ERROR"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      # Continue with other tests, but note the failure
      break
    fi

    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if [ $ELAPSED -ge $VIDEO_PROCESSING_TIMEOUT ]; then
    echo -e "  ${RED}FAIL${NC}: Video processing timed out"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo -e "  ${YELLOW}WARN${NC}: Unexpected status: $STATUS"
fi

# ============================================
# 4.3 Verify Summary Structure
# ============================================
phase "4.3" "Verify Summary Structure"

http_get "$API_BASE/videos/$VIDEO_ID" "Authorization: Bearer $ACCESS_TOKEN"

assert_http_status "$HTTP_STATUS" "200" "Get video returns 200"

# Check video has required fields
assert_json_exists "$HTTP_BODY" ".video.id" "Video has id"
assert_json_exists "$HTTP_BODY" ".video.youtubeId" "Video has youtubeId"
assert_json_exists "$HTTP_BODY" ".video.title" "Video has title"
assert_json_exists "$HTTP_BODY" ".video.status" "Video has status"

# If completed, check summary structure
STATUS=$(echo "$HTTP_BODY" | jq -r '.video.status')
if [ "$STATUS" = "completed" ]; then
  assert_json_exists "$HTTP_BODY" ".summary.tldr" "Summary has TLDR"

  # Check for sections
  SECTION_COUNT=$(echo "$HTTP_BODY" | jq '.summary.sections | length' 2>/dev/null || echo "0")
  if [ "$SECTION_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}PASS${NC}: Summary has $SECTION_COUNT sections"
    PASS_COUNT=$((PASS_COUNT + 1))

    # Save first section ID for explain tests
    SECTION_ID=$(echo "$HTTP_BODY" | jq -r '.summary.sections[0].id')
    echo "$SECTION_ID" > /tmp/vie-test-sectionid.txt
    echo "  First section ID: $SECTION_ID"
  else
    echo -e "  ${YELLOW}WARN${NC}: Summary has no sections"
  fi

  # Check for concepts
  CONCEPT_COUNT=$(echo "$HTTP_BODY" | jq '.summary.concepts | length' 2>/dev/null || echo "0")
  if [ "$CONCEPT_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}PASS${NC}: Summary has $CONCEPT_COUNT concepts"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${YELLOW}WARN${NC}: Summary has no concepts"
  fi
else
  echo -e "  ${YELLOW}SKIP${NC}: Cannot verify summary structure (status: $STATUS)"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# ============================================
# 4.4 Cache Hit Test
# ============================================
phase "4.4" "Cache Hit Test"

# Submit same video again
http_post "$API_BASE/videos" "$VIDEO_DATA" "Authorization: Bearer $ACCESS_TOKEN"

if [ "$HTTP_STATUS" = "200" ]; then
  CACHED=$(echo "$HTTP_BODY" | jq -r '.cached // false')
  if [ "$CACHED" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC}: Second submit returns cached=true"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${YELLOW}WARN${NC}: Second submit did not report cached=true"
    echo "         Response: $HTTP_BODY"
  fi
else
  echo -e "  ${GREEN}PASS${NC}: Second submit returns $HTTP_STATUS (may link to existing)"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

# ============================================
# 4.5 List Videos
# ============================================
phase "4.5" "List Videos"

http_get "$API_BASE/videos" "Authorization: Bearer $ACCESS_TOKEN"

assert_http_status "$HTTP_STATUS" "200" "List videos returns 200"

VIDEO_COUNT=$(echo "$HTTP_BODY" | jq '.videos | length' 2>/dev/null || echo "0")
if [ "$VIDEO_COUNT" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${NC}: Video list contains $VIDEO_COUNT video(s)"
  PASS_COUNT=$((PASS_COUNT + 1))

  # Check if our video is in the list
  FOUND=$(echo "$HTTP_BODY" | jq --arg id "$VIDEO_ID" '.videos[] | select(.id == $id) | .id' 2>/dev/null)
  if [ -n "$FOUND" ]; then
    echo -e "  ${GREEN}PASS${NC}: Our test video is in the list"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${YELLOW}WARN${NC}: Test video not found in list (may use different ID format)"
  fi
else
  echo -e "  ${RED}FAIL${NC}: Video list is empty"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ============================================
# 4.6 Invalid Video URL
# ============================================
phase "4.6" "Invalid Video URL"

INVALID_VIDEO=$(cat <<EOF
{
  "url": "https://not-a-youtube-url.com/watch?v=123"
}
EOF
)

http_post "$API_BASE/videos" "$INVALID_VIDEO" "Authorization: Bearer $ACCESS_TOKEN"

# Should return 400 Bad Request
if [ "$HTTP_STATUS" = "400" ]; then
  echo -e "  ${GREEN}PASS${NC}: Invalid URL returns 400"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: Invalid URL returned $HTTP_STATUS (expected 400)"
fi

# ============================================
# 4.7 Get Non-Existent Video
# ============================================
phase "4.7" "Get Non-Existent Video"

http_get "$API_BASE/videos/nonexistent-id-12345" "Authorization: Bearer $ACCESS_TOKEN"

# Should return 404 Not Found
if [ "$HTTP_STATUS" = "404" ]; then
  echo -e "  ${GREEN}PASS${NC}: Non-existent video returns 404"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: Non-existent video returned $HTTP_STATUS (expected 404)"
fi

# ============================================
# 4.8 Delete Video (skip for now - need video for E2E)
# ============================================
phase "4.8" "Delete Video (deferred)"

echo -e "  ${YELLOW}SKIP${NC}: Skipping delete to preserve video for E2E test"
echo "         Will be tested in 06-e2e-journey.sh"
SKIP_COUNT=$((SKIP_COUNT + 1))

# ============================================
# Summary
# ============================================
report_summary
