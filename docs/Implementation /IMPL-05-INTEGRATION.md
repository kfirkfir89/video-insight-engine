# Implementation Track 5: Integration Testing

> **Run after all parallel tracks are complete.**
> **Prerequisites:** All of IMPL-00 through IMPL-04 complete.

---

## Overview

This track validates that all services work together correctly.

| Phase | What | Tests |
|-------|------|-------|
| 1 | Infrastructure | MongoDB up |
| 2 | Service Health | All services responding |
| 3 | Auth Flow | Register → Login → Token refresh |
| 4 | Video Flow | Submit → Process → Summary |
| 5 | Explain Flow | Section expand → Cache hit |
| 6 | Full E2E | Complete user journey |

---

## Phase 1: Infrastructure Validation

### 1.1 Start All Services

```bash
# Start everything
docker-compose up -d

# Wait for health checks
sleep 30

# Check all containers
docker-compose ps
```

**Expected output:**
```
NAME            STATUS                   PORTS
vie-mongodb     Up (healthy)             27017
vie-api         Up                       3000
vie-web         Up                       5173
vie-summarizer  Up                       8000
vie-explainer   Up                       8001
```

### 1.2 Verify Infrastructure

```bash
# MongoDB
docker exec vie-mongodb mongosh --eval "db.runCommand('ping')"
# Expected: { ok: 1 }

# Check indexes exist
docker exec vie-mongodb mongosh video-insight-engine --eval "db.videoSummaryCache.getIndexes()"
# Expected: youtubeId index
```

---

## Phase 2: Service Health Checks

### 2.1 All Health Endpoints

```bash
# API
curl -s http://localhost:3000/health | jq
# Expected: {"status":"ok","timestamp":"..."}

# Summarizer
curl -s http://localhost:8000/health | jq
# Expected: {"status":"ok","service":"vie-summarizer",...}

# Explainer
curl -s http://localhost:8001/health | jq
# Expected: {"status":"ok","service":"vie-explainer",...}

# Web (should return HTML)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200
```

### 2.2 Service Logs Check

```bash
# Check for startup errors
docker-compose logs vie-api 2>&1 | grep -i error
docker-compose logs vie-summarizer 2>&1 | grep -i error
docker-compose logs vie-explainer 2>&1 | grep -i error

# Should return empty (no errors)
```

---

## Phase 3: Auth Flow Test

### 3.1 Register User

```bash
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "integration@test.com",
    "password": "Test123!Pass",
    "name": "Integration Test"
  }')

echo $REGISTER_RESPONSE | jq

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.accessToken')
echo "Token: $TOKEN"
```

**Expected:**
```json
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "email": "integration@test.com",
    "name": "Integration Test"
  }
}
```

### 3.2 Login User

```bash
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "integration@test.com",
    "password": "Test123!Pass"
  }')

echo $LOGIN_RESPONSE | jq

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
```

### 3.3 Get Current User

```bash
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected:**
```json
{
  "id": "...",
  "email": "integration@test.com",
  "name": "Integration Test"
}
```

### 3.4 Token Refresh

```bash
# Should work with cookie from login
curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=..." | jq
```

---

## Phase 4: Video Flow Test

### 4.1 Submit Video

```bash
# Use a short, known video for testing
VIDEO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

echo $VIDEO_RESPONSE | jq

VIDEO_ID=$(echo $VIDEO_RESPONSE | jq -r '.video.id')
VIDEO_SUMMARY_ID=$(echo $VIDEO_RESPONSE | jq -r '.video.videoSummaryId')
CACHED=$(echo $VIDEO_RESPONSE | jq -r '.cached')

echo "Video ID: $VIDEO_ID"
echo "Summary ID: $VIDEO_SUMMARY_ID"
echo "Cached: $CACHED"
```

### 4.2 Check Processing Status

```bash
# Poll for status (if not cached)
if [ "$CACHED" = "false" ]; then
  echo "Waiting for processing..."
  
  for i in {1..60}; do
    STATUS=$(curl -s http://localhost:3000/api/videos/$VIDEO_ID \
      -H "Authorization: Bearer $TOKEN" | jq -r '.video.status')
    
    echo "Status: $STATUS"
    
    if [ "$STATUS" = "completed" ]; then
      echo "✅ Processing complete!"
      break
    elif [ "$STATUS" = "failed" ]; then
      echo "❌ Processing failed!"
      exit 1
    fi
    
    sleep 5
  done
fi
```

### 4.3 Verify Summary

```bash
FULL_VIDEO=$(curl -s http://localhost:3000/api/videos/$VIDEO_ID \
  -H "Authorization: Bearer $TOKEN")

echo $FULL_VIDEO | jq '.summary'

# Check sections exist
SECTION_COUNT=$(echo $FULL_VIDEO | jq '.summary.sections | length')
echo "Sections: $SECTION_COUNT"

# Check concepts exist
CONCEPT_COUNT=$(echo $FULL_VIDEO | jq '.summary.concepts | length')
echo "Concepts: $CONCEPT_COUNT"

# Get first section ID for next test
SECTION_ID=$(echo $FULL_VIDEO | jq -r '.summary.sections[0].id')
echo "First Section ID: $SECTION_ID"
```

### 4.4 Verify Cache Hit

```bash
# Submit same video again (should be cached)
CACHE_TEST=$(curl -s -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

CACHED=$(echo $CACHE_TEST | jq -r '.cached')
echo "Cache hit: $CACHED"

# Should be true
if [ "$CACHED" != "true" ]; then
  echo "❌ Cache not working!"
  exit 1
fi
echo "✅ Cache working!"
```

---

## Phase 5: Explain Flow Test

### 5.1 Explain Section

```bash
EXPLAIN_RESPONSE=$(curl -s "http://localhost:3000/api/explain/$VIDEO_SUMMARY_ID/section/$SECTION_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $EXPLAIN_RESPONSE | jq

EXPANSION=$(echo $EXPLAIN_RESPONSE | jq -r '.expansion')
echo "Expansion length: ${#EXPANSION}"

# Should have content
if [ ${#EXPANSION} -lt 100 ]; then
  echo "❌ Expansion too short!"
  exit 1
fi
echo "✅ Explain working!"
```

### 5.2 Verify Expansion Cache

```bash
# Request same expansion (should be cached)
START=$(date +%s%N)

CACHED_EXPANSION=$(curl -s "http://localhost:3000/api/explain/$VIDEO_SUMMARY_ID/section/$SECTION_ID" \
  -H "Authorization: Bearer $TOKEN")

END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

echo "Cache response time: ${DURATION}ms"

# Should be fast (< 500ms) if cached
if [ $DURATION -gt 500 ]; then
  echo "⚠️ Slow response - may not be cached"
else
  echo "✅ Expansion cache working!"
fi
```

---

## Phase 6: Full E2E Journey

### 6.1 Complete User Journey Script

Create `scripts/e2e-test.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:3000/api"
EMAIL="e2e-$(date +%s)@test.com"
PASSWORD="Test123!Pass"

echo "🚀 Starting E2E Test"
echo "===================="

# 1. Register
echo -e "\n📝 Registering user..."
REGISTER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"E2E Test\"}")

TOKEN=$(echo $REGISTER | jq -r '.accessToken')
USER_ID=$(echo $REGISTER | jq -r '.user.id')
echo "✅ Registered: $USER_ID"

# 2. Submit video
echo -e "\n📺 Submitting video..."
VIDEO=$(curl -s -X POST "$BASE_URL/videos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}')

VIDEO_ID=$(echo $VIDEO | jq -r '.video.id')
SUMMARY_ID=$(echo $VIDEO | jq -r '.video.videoSummaryId')
echo "✅ Video submitted: $VIDEO_ID"

# 3. Wait for processing
echo -e "\n⏳ Waiting for processing..."
for i in {1..120}; do
  STATUS=$(curl -s "$BASE_URL/videos/$VIDEO_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.video.status')
  
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Processing complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Processing failed!"
    exit 1
  fi
  
  echo "  Status: $STATUS (attempt $i)"
  sleep 2
done

# 4. Get summary
echo -e "\n📖 Fetching summary..."
SUMMARY=$(curl -s "$BASE_URL/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $TOKEN")

TLDR=$(echo $SUMMARY | jq -r '.summary.tldr')
SECTIONS=$(echo $SUMMARY | jq '.summary.sections | length')
CONCEPTS=$(echo $SUMMARY | jq '.summary.concepts | length')

echo "✅ Summary received:"
echo "   TLDR: ${TLDR:0:100}..."
echo "   Sections: $SECTIONS"
echo "   Concepts: $CONCEPTS"

# 5. Explain section
SECTION_ID=$(echo $SUMMARY | jq -r '.summary.sections[0].id')
echo -e "\n💡 Explaining section $SECTION_ID..."

EXPANSION=$(curl -s "$BASE_URL/explain/$SUMMARY_ID/section/$SECTION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.expansion')

echo "✅ Expansion received: ${#EXPANSION} chars"

# 6. List videos
echo -e "\n📋 Listing videos..."
VIDEOS=$(curl -s "$BASE_URL/videos" \
  -H "Authorization: Bearer $TOKEN" | jq '.videos | length')

echo "✅ Videos in library: $VIDEOS"

# 7. Delete video
echo -e "\n🗑️ Deleting video..."
curl -s -X DELETE "$BASE_URL/videos/$VIDEO_ID" \
  -H "Authorization: Bearer $TOKEN"
echo "✅ Video deleted"

# 8. Logout
echo -e "\n👋 Logging out..."
curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $TOKEN"
echo "✅ Logged out"

echo -e "\n===================="
echo "🎉 E2E Test Complete!"
```

Run:
```bash
chmod +x scripts/e2e-test.sh
./scripts/e2e-test.sh
```

---

## Phase 7: WebSocket Test

### 7.1 WebSocket Connection Test

Create `scripts/ws-test.js`:

```javascript
const WebSocket = require('ws');

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('Usage: node ws-test.js <token>');
  process.exit(1);
}

const ws = new WebSocket(`ws://localhost:3000/ws?token=${TOKEN}`);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('📩 Event:', JSON.stringify(event, null, 2));
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});

// Keep alive for 60 seconds
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 60000);
```

Run:
```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"integration@test.com","password":"Test123!Pass"}' | jq -r '.accessToken')

node scripts/ws-test.js $TOKEN

# In another terminal, submit a video to see status events
```

---

## Phase 8: Load Test (Optional)

### 8.1 Simple Load Test

```bash
# Install hey if not available
# go install github.com/rakyll/hey@latest

# Test auth endpoint
hey -n 100 -c 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -d '{"email":"load@test.com","password":"test"}' \
  http://localhost:3000/api/auth/login

# Test videos list (with token)
hey -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/videos
```

---

## Integration Checklist

### ✅ Infrastructure
- [ ] MongoDB healthy and indexes created
- [ ] All services start without errors

### ✅ Auth Flow
- [ ] Registration creates user
- [ ] Login returns tokens
- [ ] Protected routes require auth
- [ ] Token refresh works

### ✅ Video Flow
- [ ] Submit video creates cache entry
- [ ] HTTP POST triggers summarizer
- [ ] Summarizer processes job (BackgroundTasks)
- [ ] Status updates via WebSocket
- [ ] Summary saved to cache
- [ ] Cache hit on duplicate submit

### ✅ Explain Flow
- [ ] Section expansion generated
- [ ] Expansion cached
- [ ] Cache hit on duplicate request

### ✅ Full Journey
- [ ] E2E script passes
- [ ] All features work together
- [ ] No error logs

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Check dependencies
docker-compose ps

# Restart specific service
docker-compose restart <service-name>
```

### Processing Stuck

```bash
# Check summarizer logs
docker-compose logs -f vie-summarizer

# Check if summarizer is healthy
curl http://localhost:8000/health
```

### Cache Not Working

```bash
# Check MongoDB entries
docker exec vie-mongodb mongosh video-insight-engine --eval "
  db.videoSummaryCache.find({}).limit(5).pretty()
"
```

### MCP Connection Failed

```bash
# Check explainer logs
docker-compose logs vie-explainer

# Test MCP server directly
docker exec vie-explainer python -m src.server
```

---

## Success Criteria

Integration is complete when:

1. ✅ All 5 services running and healthy
2. ✅ User can register and login
3. ✅ Video submission triggers processing
4. ✅ Summary appears after processing
5. ✅ Section expansion works
6. ✅ WebSocket receives status updates
7. ✅ Cache prevents duplicate processing
8. ✅ E2E script passes without errors

---

## Next Steps

After integration passes:

1. **Production prep**: Review SECURITY.md, add proper secrets
2. **Monitoring**: Add logging, metrics, alerts
3. **CI/CD**: Set up automated testing
4. **Documentation**: Update README with deployment guide
