# Code Review Fixes

**Generated:** 2026-01-09
**Status:** Pending fixes before commit

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Pending |
| High | 4 | Pending |
| Medium | 5 | Pending |
| Low | 3 | Optional |

---

## Critical Fixes

### 1. Restore Auth Rate Limits

**File:** `api/src/routes/auth.routes.ts`
**Lines:** 9-12, 43-46

**Problem:** Rate limits weakened for testing, never restored.

**Current (INSECURE):**
```typescript
// Register - line 9-12
config: {
  rateLimit: { max: 50, timeWindow: '1 minute' },
},

// Login - line 43-46
config: {
  rateLimit: { max: 50, timeWindow: '1 minute' },
},
```

**Fix:**
```typescript
// Register - restore to 5/hour
config: {
  rateLimit: { max: 5, timeWindow: '1 hour' },
},

// Login - restore to 10/15min
config: {
  rateLimit: { max: 10, timeWindow: '15 minutes' },
},
```

**Alternative (env-based for testing):**
```typescript
const isTest = process.env.NODE_ENV === 'test';

// Register
config: {
  rateLimit: {
    max: isTest ? 50 : 5,
    timeWindow: isTest ? '1 minute' : '1 hour'
  },
},
```

---

### 2. Add Authentication to Internal Routes

**File:** `api/src/routes/internal.routes.ts`
**Lines:** 30-91

**Problem:** `/internal/status` endpoint has no authentication. Anyone can manipulate video status.

**Current (INSECURE):**
```typescript
fastify.post<{
  Body: z.infer<typeof statusEventSchema>;
}>('/status', async (req, reply) => {
  // No auth check - accepts any request
```

**Fix Option A - Shared Secret:**

Add to `.env`:
```bash
INTERNAL_SECRET=your-secure-random-secret-here
```

Add to `api/src/config.ts`:
```typescript
INTERNAL_SECRET: z.string().min(16).default('dev-internal-secret'),
```

Update route:
```typescript
fastify.post<{
  Body: z.infer<typeof statusEventSchema>;
}>('/status', async (req, reply) => {
  // Verify internal secret
  const secret = req.headers['x-internal-secret'];
  if (secret !== config.INTERNAL_SECRET) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // ... rest of handler
```

Update summarizer callback (`services/summarizer/src/services/status_callback.py`):
```python
headers = {
    "Content-Type": "application/json",
    "X-Internal-Secret": os.getenv("INTERNAL_SECRET", "dev-internal-secret")
}
```

**Fix Option B - IP Whitelist (simpler):**
```typescript
const ALLOWED_IPS = ['127.0.0.1', '::1', '172.16.0.0/12', '10.0.0.0/8'];

fastify.post('/status', async (req, reply) => {
  const clientIp = req.ip;
  if (!isAllowedIp(clientIp, ALLOWED_IPS)) {
    return reply.status(403).send({ error: 'Forbidden' });
  }
  // ... rest of handler
```

---

## High Severity Fixes

### 3. Validate YouTube IDs

**File:** `apps/web/src/components/videos/YouTubePlayer.tsx`
**Line:** 58

**Problem:** YouTube ID directly interpolated into URL without validation.

**Current:**
```tsx
src={`https://www.youtube.com/embed/${youtubeId}?${params.toString()}`}
```

**Fix:**
```tsx
// Add at top of file
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// In component
export function YouTubePlayer({ youtubeId, ...props }: YouTubePlayerProps) {
  // Validate YouTube ID format
  if (!YOUTUBE_ID_REGEX.test(youtubeId)) {
    return (
      <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
        Invalid video ID
      </div>
    );
  }

  // ... rest of component

  return (
    <iframe
      src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?${params.toString()}`}
      // ...
```

---

### 4. Add Iframe Sandbox Attribute

**File:** `apps/web/src/components/videos/YouTubePlayer.tsx`
**Line:** 54-65

**Problem:** YouTube iframe has no sandbox restrictions.

**Current:**
```tsx
<iframe
  ref={iframeRef}
  src={`https://www.youtube.com/embed/${youtubeId}?${params.toString()}`}
  className={cn("w-full h-full", className)}
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>
```

**Fix:**
```tsx
<iframe
  ref={iframeRef}
  src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?${params.toString()}`}
  className={cn("w-full h-full", className)}
  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>
```

---

### 5. Move WebSocket Token from URL to Message

**File:** `apps/web/src/hooks/use-websocket.ts`
**Line:** 56

**Problem:** JWT token in URL can be logged by proxies/browsers.

**Current:**
```typescript
const ws = new WebSocket(`${WS_URL}/ws?token=${accessToken}`);
```

**Fix (Frontend):**
```typescript
const ws = new WebSocket(`${WS_URL}/ws`);

ws.onopen = () => {
  // Send auth message after connection
  ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
  console.log('[WS] Connected, sending auth');
};
```

**Fix (Backend - api/src/plugins/websocket.ts):**
```typescript
// Change from query param auth to message-based auth
wss.on('connection', (ws, req) => {
  let authenticated = false;
  let userId: string | null = null;

  // Set auth timeout
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      ws.close(4001, 'Authentication timeout');
    }
  }, 5000);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'auth' && !authenticated) {
        const decoded = fastify.jwt.verify(message.token);
        userId = decoded.userId;
        authenticated = true;
        clearTimeout(authTimeout);
        connections.set(userId, ws);
        ws.send(JSON.stringify({ type: 'connected' }));
      }
    } catch (err) {
      ws.close(4001, 'Invalid token');
    }
  });
});
```

**Note:** This is a larger change. Can defer if needed, but document the risk.

---

### 6. Add ObjectId Validation Helper

**File:** `api/src/utils/validation.ts` (NEW)

**Problem:** Invalid ObjectId strings cause unhandled exceptions.

**Create new file:**
```typescript
import { ObjectId } from 'mongodb';

/**
 * Validates if a string is a valid MongoDB ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Safely creates an ObjectId, returns null if invalid
 */
export function toObjectId(id: string): ObjectId | null {
  if (!isValidObjectId(id)) {
    return null;
  }
  return new ObjectId(id);
}
```

**Update services to use it:**
```typescript
// In video.service.ts, folder.service.ts, memorize.service.ts
import { isValidObjectId, toObjectId } from '../utils/validation.js';

async getById(userId: string, id: string) {
  if (!isValidObjectId(id) || !isValidObjectId(userId)) {
    return null;
  }
  // ... rest of function
}
```

---

## Medium Severity Fixes

### 7. Remove Console.log Statements

**File:** `apps/web/src/hooks/use-websocket.ts`
**Lines:** 59, 65, 77

**Current:**
```typescript
console.log('[WS] Connected');
console.log('[WS] Disconnected:', event.code);
console.log('[WS] Error:', error);
```

**Fix Option A - Remove entirely:**
```typescript
// Delete the console.log lines
```

**Fix Option B - Use debug utility:**
```typescript
const DEBUG = import.meta.env.DEV;

const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[WS]', ...args);
};

// Usage
log('Connected');
log('Disconnected:', event.code);
```

---

### 8. Generic Error Messages

**File:** `api/src/routes/explain.routes.ts`
**Lines:** 38-44

**Current:**
```typescript
return reply.status(500).send({
  error: 'Internal Server Error',
  message: error instanceof Error ? error.message : 'Failed to generate explanation',
});
```

**Fix:**
```typescript
// Log detailed error server-side
fastify.log.error(error, 'explain_auto failed');

// Return generic message to client
return reply.status(500).send({
  error: 'Internal Server Error',
  message: 'An unexpected error occurred. Please try again.',
  requestId: req.id,
});
```

---

### 9. Secure Temp Files in Integration Tests

**File:** `scripts/integration/03-auth-flow.sh`
**Lines:** 221-222

**Current:**
```bash
echo "$TEST_EMAIL" > /tmp/vie-test-email.txt
```

**Fix:**
```bash
# At start of script
TEST_TMP_DIR=$(mktemp -d -t vie-test-XXXXXX)
chmod 700 "$TEST_TMP_DIR"
trap "rm -rf $TEST_TMP_DIR" EXIT

# Usage
echo "$TEST_EMAIL" > "$TEST_TMP_DIR/email.txt"
```

---

### 10. Fix Dockerfile npm install

**File:** `api/Dockerfile`
**Line:** 5

**Current:**
```dockerfile
RUN npm install && npm install typescript @types/node @types/bcrypt @types/ws tsx
```

**Fix:**
```dockerfile
RUN npm ci
```

---

### 11. Add CSRF Protection to Internal Routes

**File:** `api/src/routes/internal.routes.ts`

**Add origin check:**
```typescript
fastify.addHook('preHandler', async (req, reply) => {
  const origin = req.headers.origin;
  const host = req.headers.host;

  // Only allow requests without origin (server-to-server) or from same host
  if (origin && !origin.includes(host || '')) {
    return reply.status(403).send({ error: 'CSRF check failed' });
  }
});
```

---

## Low Severity (Optional)

### 12. Add Error Boundary to VideoDetailPage

**File:** `apps/web/src/pages/VideoDetailPage.tsx`

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function VideoDetailPageContent() {
  // ... current implementation
}

export function VideoDetailPage() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong loading this video.</div>}>
      <VideoDetailPageContent />
    </ErrorBoundary>
  );
}
```

---

### 13. Document Production Secrets Requirement

**File:** `docker-compose.yml`
**Lines:** 52-53

Already has defaults with warning comments. Add to README:
```markdown
## Production Deployment

**IMPORTANT:** Set these environment variables in production:
- `JWT_SECRET` - Min 32 characters, random
- `JWT_REFRESH_SECRET` - Min 32 characters, random, different from JWT_SECRET
- `INTERNAL_SECRET` - For service-to-service auth
```

---

## Fix Priority Order

```
1. [5 min]  Restore auth rate limits (Critical)
2. [15 min] Add internal route auth (Critical)
3. [5 min]  Validate YouTube IDs (High)
4. [2 min]  Add iframe sandbox (High)
5. [10 min] Add ObjectId validation (High)
6. [2 min]  Remove console.log (Medium)
7. [5 min]  Generic error messages (Medium)
8. [30 min] WebSocket token migration (High - can defer)
```

**Estimated total time:** ~1 hour for critical/high fixes

---

## Verification Commands

After fixes, run:

```bash
# Type check
cd api && pnpm typecheck

# Run integration tests
./scripts/integration/run-all.sh --skip-start

# Test rate limiting manually
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Should see 429 after hitting limit

# Test internal route auth
curl -X POST http://localhost:3000/internal/status \
  -H "Content-Type: application/json" \
  -d '{"type":"video.status","payload":{}}'
# Should return 401 Unauthorized
```
