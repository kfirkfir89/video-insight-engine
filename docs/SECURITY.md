# Security

Authentication, authorization, and protection mechanisms.

---

## Authentication Flow

### JWT Token Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    TOKEN ARCHITECTURE                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Access Token                    Refresh Token               │
│  ├── Lifetime: 15 minutes        ├── Lifetime: 7 days       │
│  ├── Stored: Memory only         ├── Stored: HttpOnly cookie│
│  ├── Contains: userId, email     ├── Contains: userId       │
│  └── Used: API requests          └── Used: Get new access   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Endpoints

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh    ← New
POST /api/auth/logout     ← New
GET  /api/auth/me
```

### Login Response

```json
{
  "accessToken": "eyJhbG...",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "email": "...",
    "name": "..."
  }
}
```

Refresh token set as HttpOnly cookie:

```
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh
```

### Refresh Flow

```
┌─────────┐                    ┌─────────┐
│ Frontend│                    │ vie-api │
└────┬────┘                    └────┬────┘
     │                              │
     │  Access token expired        │
     │  (401 response)              │
     │                              │
     │  POST /auth/refresh          │
     │  Cookie: refreshToken=xxx    │
     │─────────────────────────────►│
     │                              │
     │  Verify refresh token        │
     │  Generate new access token   │
     │                              │
     │  { accessToken, expiresIn }  │
     │◄─────────────────────────────│
     │                              │
     │  Retry original request      │
     │─────────────────────────────►│
```

### Implementation

```typescript
// api/src/routes/auth.routes.ts

// Login - returns access token + sets refresh cookie
fastify.post("/login", async (req, reply) => {
  const { email, password } = req.body;

  const user = await verifyCredentials(email, password);

  const accessToken = fastify.jwt.sign(
    { userId: user._id, email: user.email },
    { expiresIn: "15m" }
  );

  const refreshToken = fastify.jwt.sign(
    { userId: user._id },
    { expiresIn: "7d", secret: process.env.JWT_REFRESH_SECRET }
  );

  reply.setCookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return { accessToken, expiresIn: 900, user };
});

// Refresh - validates refresh token, returns new access token
fastify.post("/refresh", async (req, reply) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return reply.code(401).send({ error: "REFRESH_EXPIRED" });
  }

  try {
    const payload = fastify.jwt.verify(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    const accessToken = fastify.jwt.sign(
      { userId: payload.userId },
      { expiresIn: "15m" }
    );

    return { accessToken, expiresIn: 900 };
  } catch {
    reply.clearCookie("refreshToken");
    return reply.code(401).send({ error: "REFRESH_EXPIRED" });
  }
});

// Logout - clears refresh token cookie
fastify.post("/logout", async (req, reply) => {
  reply.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  return { success: true };
});
```

---

## Rate Limiting

### Limits by Endpoint

| Endpoint              | Limit | Window   | Scope |
| --------------------- | ----- | -------- | ----- |
| `POST /auth/register` | 5     | 1 hour   | IP    |
| `POST /auth/login`    | 10    | 15 min   | IP    |
| `POST /auth/refresh`  | 30    | 15 min   | IP    |
| `POST /videos`        | 10    | 24 hours | User  |
| `GET /explain/*`      | 60    | 1 hour   | User  |
| `POST /explain/chat`  | 100   | 1 hour   | User  |
| `* (default)`         | 100   | 1 min    | User  |

### Implementation

```typescript
// api/src/plugins/rate-limit.ts
import rateLimit from "@fastify/rate-limit";

await fastify.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Per-route override for video submission
fastify.post(
  "/videos",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "24 hours",
        keyGenerator: (req) => req.user.id,
      },
    },
  },
  handler
);

// Auth routes - limit by IP
fastify.post(
  "/auth/login",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
        keyGenerator: (req) => req.ip,
      },
    },
  },
  loginHandler
);
```

### Response on Limit

```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Try again in 3600 seconds.",
  "retryAfter": 3600
}
```

Headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
Retry-After: 3600
```

---

## Input Validation

### YouTube URL Validation

```typescript
const youtubeUrlSchema = z
  .string()
  .url()
  .refine((url) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
      /^https?:\/\/youtu\.be\/[\w-]{11}/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11}/,
    ];
    return patterns.some((p) => p.test(url));
  }, "Invalid YouTube URL");
```

### Password Requirements

```typescript
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain uppercase letter")
  .regex(/[a-z]/, "Password must contain lowercase letter")
  .regex(/[0-9]/, "Password must contain number");
```

### Email Validation

```typescript
const emailSchema = z.string().email().toLowerCase().max(255);
```

---

## CORS Configuration

```typescript
// api/src/plugins/cors.ts
import cors from "@fastify/cors";

await fastify.register(cors, {
  origin: [
    "http://localhost:5173", // Dev
    process.env.FRONTEND_URL, // Prod
  ],
  credentials: true, // For cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
```

---

## Internal Service Security

### Network Isolation

```yaml
# docker-compose.yml
services:
  vie-summarizer:
    # No exposed ports - internal only
    networks:
      - vie-internal

  vie-explainer:
    # No exposed ports - internal only
    networks:
      - vie-internal

networks:
  vie-network: # External (frontend, API)
  vie-internal: # Internal only (workers)
```

### Service-to-Service Auth (Future)

For production, add API keys between services:

```bash
# .env
INTERNAL_API_KEY=xxx

# Summarizer → MongoDB uses this header
X-Internal-Key: xxx
```

---

## Security Headers

```typescript
// api/src/plugins/security.ts
import helmet from "@fastify/helmet";

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "img.youtube.com", "i.ytimg.com"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // For YouTube thumbnails
});
```

---

## Secrets Management

### Required Secrets

| Secret               | Where Used            | How to Generate           |
| -------------------- | --------------------- | ------------------------- |
| `JWT_SECRET`         | vie-api               | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | vie-api               | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY`  | summarizer, explainer | Anthropic Console         |

### Production Setup

```bash
# Never commit secrets
# Use environment variables or secrets manager

# Docker Swarm
docker secret create jwt_secret ./jwt_secret.txt

# Kubernetes
kubectl create secret generic vie-secrets \
  --from-literal=jwt-secret=xxx \
  --from-literal=anthropic-key=xxx
```

---

## Security Checklist

Before deploying:

- [ ] All secrets in environment variables (not hardcoded)
- [ ] JWT_SECRET and JWT_REFRESH_SECRET are different
- [ ] Rate limiting enabled on all routes
- [ ] CORS configured for specific origins (not `*`)
- [ ] Password hashing uses bcrypt with cost ≥ 10
- [ ] Refresh tokens stored in HttpOnly cookies
- [ ] Input validation on all user inputs
- [ ] SQL/NoSQL injection prevention (parameterized queries)
- [ ] Security headers enabled via helmet
