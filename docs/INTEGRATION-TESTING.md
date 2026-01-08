# Integration Testing Guide

> Video Insight Engine - Integration & E2E Testing

---

## Quick Start

```bash
# Run all tests
./scripts/integration/run-all.sh

# Run with services already running
./scripts/integration/run-all.sh --skip-start

# Run individual phase
./scripts/integration/03-auth-flow.sh

# Run and stop services after
./scripts/integration/run-all.sh --stop-after
```

---

## Prerequisites

Before running tests, ensure you have:

- **Docker** and **Docker Compose** installed
- **curl** for HTTP requests
- **jq** for JSON parsing
- **Node.js** 18+ (for WebSocket tests)
- **mongosh** (optional, for direct MongoDB access)

Check prerequisites:

```bash
./scripts/integration/00-check-prereqs.sh
```

---

## Test Phases

| Phase | Script                 | Description              | Status |
| ----- | ---------------------- | ------------------------ | ------ |
| 0     | 00-check-prereqs.sh    | Verify tools installed   | Ready  |
| 1     | 01-start-services.sh   | Start Docker services    | Ready  |
| 2     | 02-health-check.sh     | Health endpoint checks   | Ready  |
| 3     | 03-auth-flow.sh        | Auth workflow tests      | Ready  |
| 4     | 04-video-flow.sh       | Video submit/process     | Ready  |
| 5     | 05-explain-flow.sh     | Explain routes           | SKIP   |
| 6     | 06-e2e-journey.sh      | Complete user journey    | Ready  |
| 7     | 07-ws-test.js          | WebSocket connection     | Ready  |
| 8     | 08-cleanup.sh          | Clean test data          | Ready  |

---

## Phase Details

### Phase 0: Prerequisites Check

Verifies all required tools are installed.

**Expected output:**

```
OK docker: Docker version 24.x
OK docker-compose: v2.x
OK curl: 7.x
OK jq: jq-1.x
OK node: v20.x
```

### Phase 1: Start Services

Starts Docker Compose and waits for all services to be healthy.

**Services started:**

- vie-mongodb (Port 27017)
- vie-api (Port 3000)
- vie-summarizer (Port 8000)
- vie-explainer (Port 8001)
- vie-web (Port 5173)

**Timeout:** 120 seconds

### Phase 2: Health Checks

Verifies all services respond correctly:

| Service        | Endpoint | Expected                     |
| -------------- | -------- | ---------------------------- |
| vie-api        | /health  | `{"status":"ok"}`            |
| vie-summarizer | /health  | `{"status":"healthy"}`       |
| vie-mongodb    | ping     | `{"ok":1}`                   |
| vie-web        | /        | HTML with React mount point  |
| vie-explainer  | -        | Container running (MCP/stdio) |

### Phase 3: Auth Flow

Tests complete authentication workflow:

1. Register new user (unique email)
2. Attempt duplicate registration (expect 409)
3. Login with credentials
4. Attempt invalid login (expect 401)
5. Get current user (/me)
6. Test unauthorized access
7. Token refresh
8. Logout
9. Verify token behavior after logout

### Phase 4: Video Flow

Tests video submission and processing:

1. Submit YouTube URL
2. Poll for processing completion (max 3 min)
3. Verify summary structure (TLDR, sections, concepts)
4. Test cache hit (submit same video)
5. List videos
6. Test invalid URL (expect 400)
7. Test non-existent video (expect 404)

**Test video:** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

### Phase 5: Explain Flow (SKIPPED)

**Status:** Blocked - MCP integration not implemented

The explain routes return stub responses:

```typescript
// api/src/routes/explain.routes.ts
return { expansion: '# Coming soon\n\nMCP integration pending.' };
```

This phase documents the skip reason and verifies routes are accessible.

### Phase 6: E2E Journey

Complete user workflow:

1. Register new user
2. Login
3. Verify profile
4. Submit video
5. Wait for processing
6. Get video detail with summary
7. List videos
8. Delete video
9. Logout

Reports total journey time.

### Phase 7: WebSocket Tests

Tests WebSocket functionality:

1. Connect with valid token
2. Verify connected event
3. Reject connection without token
4. Reject connection with invalid token
5. Test connection stability

**Requires:** `ws` package (already in api dependencies)

### Phase 8: Cleanup

Removes test data:

- Temp files (cookies, tokens)
- Test users from MongoDB (email patterns: `integration-test-*`, `e2e-*`, `ws-test-*`)

**Options:**

- `--stop` Stop Docker services
- `--full` Stop services and remove volumes

---

## Running Individual Tests

```bash
# Prerequisites
./scripts/integration/00-check-prereqs.sh

# Health checks (services must be running)
./scripts/integration/02-health-check.sh

# Auth flow only
./scripts/integration/03-auth-flow.sh

# Video flow only (requires auth to run first)
./scripts/integration/04-video-flow.sh

# E2E journey (standalone)
./scripts/integration/06-e2e-journey.sh

# WebSocket tests
node scripts/integration/07-ws-test.js

# Cleanup
./scripts/integration/08-cleanup.sh
./scripts/integration/08-cleanup.sh --stop
./scripts/integration/08-cleanup.sh --full
```

---

## Environment Variables

```bash
# Required for video processing
ANTHROPIC_API_KEY=sk-ant-...

# Defaults in docker-compose.yml (change for production)
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
```

---

## Test Configuration

Configuration is in `scripts/integration/lib/config.sh`:

```bash
# Service URLs
API_URL="http://localhost:3000"
SUMMARIZER_URL="http://localhost:8000"
WEB_URL="http://localhost:5173"

# Timeouts
STARTUP_TIMEOUT=120
VIDEO_PROCESSING_TIMEOUT=180

# Test credentials
TEST_EMAIL_PREFIX="integration-test"
TEST_PASSWORD="TestPass123!"
```

---

## Known Limitations

### Explain Flow Not Testable

The MCP integration between vie-api and vie-explainer is not implemented. The explain routes return placeholder responses.

**Blocking file:** `api/src/routes/explain.routes.ts`

### Video Processing Requires API Key

Video summarization requires a valid `ANTHROPIC_API_KEY`. Without it, videos will fail to process.

### WebSocket Tests Require ws Package

The WebSocket test script requires the `ws` package. Install with:

```bash
cd api && npm install ws
```

### Test Users Not Auto-Deleted

Test users created during testing are cleaned up in Phase 8, but if tests are interrupted, manual cleanup may be needed:

```bash
docker-compose exec vie-mongodb mongosh video-insight-engine --eval "
  db.users.deleteMany({
    email: { \$regex: /^(integration-test-|e2e-|ws-test-)/ }
  })
"
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs vie-api
docker-compose logs vie-summarizer

# Restart services
docker-compose down
docker-compose up -d
```

### Video Processing Stuck

```bash
# Check summarizer logs
docker-compose logs -f vie-summarizer

# Check video status in MongoDB
docker-compose exec vie-mongodb mongosh video-insight-engine --eval "
  db.videoSummaryCache.findOne({status: 'processing'})
"
```

### Auth Tests Failing

```bash
# Check API logs
docker-compose logs vie-api | grep -i error

# Verify MongoDB connection
docker-compose exec vie-mongodb mongosh video-insight-engine --eval "
  db.users.countDocuments()
"
```

### WebSocket Tests Failing

```bash
# Verify WebSocket is enabled
curl http://localhost:3000/health

# Check if ws package is installed
node -e "require('ws')"
```

---

## CI/CD Integration

For CI environments, use:

```bash
# Start services in background
docker-compose up -d

# Wait for healthy
sleep 30

# Run tests without interactive output
./scripts/integration/run-all.sh --skip-cleanup 2>&1

# Capture exit code
EXIT_CODE=$?

# Cleanup
./scripts/integration/08-cleanup.sh --full

exit $EXIT_CODE
```

---

## Success Criteria

Integration is complete when:

- [ ] All 5 services start and pass health checks
- [ ] User can register and login
- [ ] Video submission triggers processing
- [ ] Summary appears after processing
- [ ] Cache prevents duplicate processing
- [ ] WebSocket connections work with valid tokens
- [ ] E2E journey completes without errors
- [ ] Cleanup removes test data

---

## Next Steps After Integration

1. **Production prep:** Review SECURITY.md, configure proper secrets
2. **Monitoring:** Add logging, metrics, alerts
3. **CI/CD:** Set up automated testing pipeline
4. **MCP Integration:** Implement explain routes to enable Phase 5
