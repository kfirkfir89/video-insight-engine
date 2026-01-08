#!/bin/bash
# Phase 8: Cleanup
# Removes test data and optionally stops services

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Cleanup"

# Parse arguments
STOP_SERVICES=false
FULL_CLEANUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --stop)
      STOP_SERVICES=true
      shift
      ;;
    --full)
      FULL_CLEANUP=true
      STOP_SERVICES=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --stop    Stop Docker services after cleanup"
      echo "  --full    Full cleanup: stop services and remove volumes"
      echo "  -h        Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ============================================
# Clean Temp Files
# ============================================
phase "8.1" "Clean Temp Files"

TEMP_FILES=(
  "/tmp/vie-integration-cookies.txt"
  "/tmp/vie-integration-token.txt"
  "/tmp/vie-test-email.txt"
  "/tmp/vie-test-userid.txt"
  "/tmp/vie-test-videoid.txt"
  "/tmp/vie-test-summaryid.txt"
  "/tmp/vie-test-sectionid.txt"
)

for file in "${TEMP_FILES[@]}"; do
  if [ -f "$file" ]; then
    rm -f "$file"
    echo "  Removed: $file"
  fi
done

echo -e "  ${GREEN}OK${NC} Temp files cleaned"

# ============================================
# Clean Test Users from MongoDB
# ============================================
phase "8.2" "Clean Test Users from MongoDB"

cd "$PROJECT_ROOT"

# Check if MongoDB is running
if docker-compose ps vie-mongodb 2>/dev/null | grep -q "Up"; then
  echo "  Removing test users from MongoDB..."

  # Delete users matching integration test email patterns
  CLEANUP_SCRIPT=$(cat <<'EOF'
db.users.deleteMany({
  email: { $regex: /^(integration-test-|e2e-|ws-test-).*@(test\.com|example\.com)$/ }
});
EOF
)

  RESULT=$(docker-compose exec -T vie-mongodb mongosh video-insight-engine --quiet --eval "$CLEANUP_SCRIPT" 2>/dev/null || echo "failed")

  if echo "$RESULT" | grep -q "deletedCount"; then
    DELETED=$(echo "$RESULT" | grep -o '"deletedCount":[0-9]*' | grep -o '[0-9]*')
    echo -e "  ${GREEN}OK${NC} Deleted $DELETED test user(s)"
  else
    echo -e "  ${YELLOW}WARN${NC} Could not confirm deletion"
  fi

  # Clean up orphaned userVideos for deleted users
  CLEANUP_VIDEOS=$(cat <<'EOF'
db.userVideos.deleteMany({
  userId: { $nin: db.users.distinct("_id") }
});
EOF
)

  # Note: This would require a more complex query, skip for now
  echo "  Note: Orphaned userVideos not cleaned (manual cleanup may be needed)"

else
  echo -e "  ${YELLOW}SKIP${NC} MongoDB not running"
fi

# ============================================
# Stop Services (if requested)
# ============================================
if $STOP_SERVICES; then
  phase "8.3" "Stop Services"

  cd "$PROJECT_ROOT"

  if $FULL_CLEANUP; then
    echo "  Stopping services and removing volumes..."
    docker-compose down -v --remove-orphans
    echo -e "  ${GREEN}OK${NC} Services stopped and volumes removed"
  else
    echo "  Stopping services..."
    docker-compose down --remove-orphans
    echo -e "  ${GREEN}OK${NC} Services stopped"
  fi
else
  echo ""
  echo "Services still running. Use --stop to stop them."
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
echo ""
echo "To fully reset the environment:"
echo "  $0 --full"
echo ""
echo "To just stop services (keep data):"
echo "  $0 --stop"
