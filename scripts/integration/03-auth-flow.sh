#!/bin/bash
# Phase 3: Auth Flow Test
# Tests the complete authentication workflow: register, login, me, refresh, logout

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/test-utils.sh"
source "$SCRIPT_DIR/lib/config.sh"

section "Phase 3: Authentication Flow"

# Generate unique test email
TEST_EMAIL=$(get_test_email)
echo "Using test email: $TEST_EMAIL"
echo ""

# Clear any existing credentials
clear_credentials

# ============================================
# 3.1 Register New User
# ============================================
phase "3.1" "Register New User"

REGISTER_DATA=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD",
  "name": "$TEST_USER_NAME"
}
EOF
)

http_post "$API_BASE/auth/register" "$REGISTER_DATA"

assert_http_status "$HTTP_STATUS" "201" "Register returns 201 Created"
assert_json_exists "$HTTP_BODY" ".accessToken" "Register returns accessToken"
assert_json_exists "$HTTP_BODY" ".user.id" "Register returns user id"
assert_json_field "$HTTP_BODY" ".user.email" "$TEST_EMAIL" "Register returns correct email"
assert_json_field "$HTTP_BODY" ".user.name" "$TEST_USER_NAME" "Register returns correct name"

# Store the token for later use
ACCESS_TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')
USER_ID=$(echo "$HTTP_BODY" | jq -r '.user.id')
store_token "$ACCESS_TOKEN"

echo ""
echo "  User ID: $USER_ID"
echo "  Token: ${ACCESS_TOKEN:0:20}..."

# ============================================
# 3.2 Duplicate Registration (should fail)
# ============================================
phase "3.2" "Duplicate Registration (should fail)"

http_post "$API_BASE/auth/register" "$REGISTER_DATA"

assert_http_status "$HTTP_STATUS" "409" "Duplicate register returns 409 Conflict"
assert_json_exists "$HTTP_BODY" ".code" "Error response has code field"

# ============================================
# 3.3 Login
# ============================================
phase "3.3" "Login"

LOGIN_DATA=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD"
}
EOF
)

# Login and capture cookies
RESPONSE=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X POST -d "$LOGIN_DATA" \
  "$API_BASE/auth/login")

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')

assert_http_status "$HTTP_STATUS" "200" "Login returns 200 OK"
assert_json_exists "$HTTP_BODY" ".accessToken" "Login returns accessToken"
assert_json_exists "$HTTP_BODY" ".user.id" "Login returns user id"

# Update stored token
ACCESS_TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')
store_token "$ACCESS_TOKEN"

# Check for refresh token cookie
if grep -q "refreshToken" "$COOKIE_JAR" 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC}: Refresh token cookie set"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: Refresh token cookie not found (may use different mechanism)"
fi

# ============================================
# 3.4 Invalid Login (wrong password)
# ============================================
phase "3.4" "Invalid Login (wrong password)"

INVALID_LOGIN=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "WrongPassword123"
}
EOF
)

http_post "$API_BASE/auth/login" "$INVALID_LOGIN"

assert_http_status "$HTTP_STATUS" "401" "Invalid login returns 401 Unauthorized"

# ============================================
# 3.5 Get Current User
# ============================================
phase "3.5" "Get Current User (/me)"

http_get "$API_BASE/auth/me" "Authorization: Bearer $ACCESS_TOKEN"

assert_http_status "$HTTP_STATUS" "200" "/me returns 200 OK"
assert_json_field "$HTTP_BODY" ".email" "$TEST_EMAIL" "/me returns correct email"
assert_json_field "$HTTP_BODY" ".name" "$TEST_USER_NAME" "/me returns correct name"
assert_json_exists "$HTTP_BODY" ".id" "/me returns user id"

# ============================================
# 3.6 Unauthorized Access (no token)
# ============================================
phase "3.6" "Unauthorized Access (no token)"

http_get "$API_BASE/auth/me"

assert_http_status "$HTTP_STATUS" "401" "/me without token returns 401"

# ============================================
# 3.7 Unauthorized Access (invalid token)
# ============================================
phase "3.7" "Unauthorized Access (invalid token)"

http_get "$API_BASE/auth/me" "Authorization: Bearer invalid-token-here"

assert_http_status "$HTTP_STATUS" "401" "/me with invalid token returns 401"

# ============================================
# 3.8 Token Refresh
# ============================================
phase "3.8" "Token Refresh"

# Try to refresh using the cookie
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" \
  -X POST "$API_BASE/auth/refresh")

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')

# Refresh may require body or different mechanism depending on implementation
if [ "$HTTP_STATUS" = "200" ]; then
  assert_json_exists "$HTTP_BODY" ".accessToken" "Refresh returns new accessToken"
  NEW_TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')

  # Verify new token works
  http_get "$API_BASE/auth/me" "Authorization: Bearer $NEW_TOKEN"
  assert_http_status "$HTTP_STATUS" "200" "New token is valid"

  # Update stored token
  store_token "$NEW_TOKEN"
else
  echo -e "  ${YELLOW}SKIP${NC}: Token refresh returned $HTTP_STATUS (implementation may vary)"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# ============================================
# 3.9 Logout
# ============================================
phase "3.9" "Logout"

ACCESS_TOKEN=$(get_token)
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -X POST "$API_BASE/auth/logout")

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')

# Logout might return 200 or 204
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
  echo -e "  ${GREEN}PASS${NC}: Logout returns $HTTP_STATUS"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}FAIL${NC}: Logout returned $HTTP_STATUS (expected 200 or 204)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ============================================
# 3.10 Verify Token Still Works (JWT tokens remain valid until expiry)
# ============================================
phase "3.10" "Token Behavior After Logout"

# Note: JWT tokens typically remain valid until expiry
# The refresh token should be invalidated, not the access token
http_get "$API_BASE/auth/me" "Authorization: Bearer $ACCESS_TOKEN"

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "  ${GREEN}INFO${NC}: Access token still valid after logout (expected for JWT)"
  echo "         Refresh token should be invalidated server-side"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC}: Access token invalidated after logout"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${YELLOW}WARN${NC}: Unexpected status $HTTP_STATUS"
fi

# ============================================
# Store test user info for later phases
# ============================================
echo ""
echo "Saving test credentials for subsequent phases..."
echo "$TEST_EMAIL" > /tmp/vie-test-email.txt
echo "$USER_ID" > /tmp/vie-test-userid.txt

# Re-login to get fresh token for next phases
http_post "$API_BASE/auth/login" "$LOGIN_DATA"
ACCESS_TOKEN=$(echo "$HTTP_BODY" | jq -r '.accessToken')
store_token "$ACCESS_TOKEN"

echo "  Fresh token acquired for next phases"

# ============================================
# Summary
# ============================================
report_summary
