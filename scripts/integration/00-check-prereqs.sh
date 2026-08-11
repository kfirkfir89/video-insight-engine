#!/bin/bash
# Phase 0: Check Prerequisites
# Verifies all required tools are installed before running tests

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"

section "Phase 0: Prerequisites Check"

echo "Checking required tools..."
echo ""

# Required tools
REQUIRED_TOOLS=(
  "docker"
  "docker-compose"
  "curl"
  "jq"
  "node"
)

# Optional tools
OPTIONAL_TOOLS=(
  "mongosh"
)

ALL_REQUIRED=true

# Check required tools
for tool in "${REQUIRED_TOOLS[@]}"; do
  if command -v "$tool" &> /dev/null; then
    version=$($tool --version 2>&1 | head -n1)
    echo -e "  ${GREEN}OK${NC} $tool: $version"
  else
    echo -e "  ${RED}MISSING${NC} $tool (required)"
    ALL_REQUIRED=false
  fi
done

echo ""

# Check optional tools
echo "Optional tools:"
for tool in "${OPTIONAL_TOOLS[@]}"; do
  if command -v "$tool" &> /dev/null; then
    version=$($tool --version 2>&1 | head -n1)
    echo -e "  ${GREEN}OK${NC} $tool: $version"
  else
    echo -e "  ${YELLOW}SKIP${NC} $tool (optional)"
  fi
done

echo ""

# Check Docker daemon
echo "Checking Docker daemon..."
if docker info &> /dev/null; then
  echo -e "  ${GREEN}OK${NC} Docker daemon is running"
else
  echo -e "  ${RED}FAIL${NC} Docker daemon is not running"
  ALL_REQUIRED=false
fi

echo ""

# Check Docker Compose version (v2 preferred)
echo "Checking Docker Compose..."
if docker compose version &> /dev/null; then
  echo -e "  ${GREEN}OK${NC} Docker Compose v2 (docker compose)"
elif docker-compose --version &> /dev/null; then
  echo -e "  ${GREEN}OK${NC} Docker Compose v1 (docker-compose)"
else
  echo -e "  ${RED}FAIL${NC} Docker Compose not available"
  ALL_REQUIRED=false
fi

echo ""

# Check for project docker-compose.yml
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  echo -e "  ${GREEN}OK${NC} docker-compose.yml found at $PROJECT_ROOT"
else
  echo -e "  ${RED}FAIL${NC} docker-compose.yml not found at $PROJECT_ROOT"
  ALL_REQUIRED=false
fi

echo ""

# Check for .env file or required env vars
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo -e "  ${GREEN}OK${NC} .env file found"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
  echo -e "  ${GREEN}OK${NC} ANTHROPIC_API_KEY set in environment"
else
  echo -e "  ${YELLOW}WARN${NC} No .env file and ANTHROPIC_API_KEY not set"
  echo "         Video processing will fail without API key"
fi

echo ""

# Summary
if $ALL_REQUIRED; then
  echo -e "${GREEN}All required prerequisites met!${NC}"
  exit 0
else
  echo -e "${RED}Missing required prerequisites. Please install missing tools.${NC}"
  exit 1
fi
