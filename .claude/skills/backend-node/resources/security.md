# Security Patterns

OWASP, input validation, rate limiting, and security best practices.

---

## Input Validation

### DO ✅

```typescript
import { z } from 'zod';

// Validate ALL external input with strict schemas
const createUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  name: z.string().min(2).max(100).trim(),
  password: z.string().min(8).max(100),
  age: z.number().int().min(18).max(120).optional(),
});

// Validate params and query
const userParamsSchema = z.object({
  id: z.string().length(24).regex(/^[a-f0-9]+$/i), // MongoDB ObjectId
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Use in routes
app.post('/users', {
  schema: { body: zodToJsonSchema(createUserSchema) },
  handler: createUser,
});
```

### DON'T ❌

```typescript
// Trust user input
app.post('/users', async (request) => {
  const user = await db.users.insertOne(request.body); // No validation!
});

// Partial validation
const { email } = request.body;
if (!email) throw new Error('Email required');
// Missing: format, length, sanitization
```

---

## SQL/NoSQL Injection Prevention

### DO ✅

```typescript
// MongoDB - Use typed queries, never string concatenation
async function findUser(email: string): Promise<User | null> {
  // ✅ Safe - email is a parameter
  return collection.findOne({ email });
}

// ✅ Safe aggregation
const pipeline = [
  { $match: { status: userStatus } }, // Variable, not string concat
  { $group: { _id: '$category', count: { $sum: 1 } } },
];

// PostgreSQL - Use parameterized queries
const result = await db.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, status]
);
```

### DON'T ❌

```typescript
// ❌ String interpolation = INJECTION!
const user = await collection.findOne({ 
  $where: `this.email === '${email}'` // Dangerous!
});

// ❌ SQL string building
const query = `SELECT * FROM users WHERE email = '${email}'`; // SQL injection!
```

---

## XSS Prevention

### DO ✅

```typescript
import DOMPurify from 'isomorphic-dompurify';
import { escape } from 'html-escaper';

// Sanitize HTML content (if you must allow HTML)
function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
}

// Escape for plain text output
function escapeHtml(text: string): string {
  return escape(text);
}

// Set security headers
import helmet from '@fastify/helmet';

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  xssFilter: true,
});
```

---

## CORS Configuration

### DO ✅

```typescript
import cors from '@fastify/cors';

// Strict CORS for production
await app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = [
      'https://app.example.com',
      'https://admin.example.com',
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
});
```

### DON'T ❌

```typescript
// ❌ Allow everything
await app.register(cors, { origin: '*' });

// ❌ Reflect origin (dangerous!)
await app.register(cors, { origin: true });
```

---

## Rate Limiting

### DO ✅

```typescript
import rateLimit from '@fastify/rate-limit';

// Global rate limit
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return request.headers['x-forwarded-for'] as string || request.ip;
  },
  errorResponseBuilder: (request, context) => ({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Try again in ${context.after}`,
    },
  }),
});

// Stricter limits for sensitive routes
app.post('/auth/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  },
  handler: loginHandler,
});

// Per-user limits with Redis
await app.register(rateLimit, {
  redis: redisClient,
  keyGenerator: (request) => request.user?.id ?? request.ip,
});
```

---

## Authentication Security

### DO ✅

```typescript
// Secure password hashing
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Adjust based on performance needs

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Timing-safe comparison
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash); // Already timing-safe
}

// Secure token generation
import crypto from 'crypto';

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// JWT with proper settings
import jwt from 'jsonwebtoken';

const token = jwt.sign(payload, secret, {
  expiresIn: '15m',
  algorithm: 'HS256',
  issuer: 'api.example.com',
  audience: 'app.example.com',
});
```

---

## Secrets Management

### DO ✅

```typescript
// Environment variables (not in code!)
const config = {
  JWT_SECRET: process.env.JWT_SECRET,
  DB_PASSWORD: process.env.DB_PASSWORD,
  API_KEY: process.env.API_KEY,
};

// Validate required secrets at startup
function validateSecrets(): void {
  const required = ['JWT_SECRET', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  
  // Validate secret strength
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}

// Never log secrets
app.addHook('onRequest', (request) => {
  request.log.info({
    method: request.method,
    url: request.url,
    // Never: authorization: request.headers.authorization
  });
});
```

### DON'T ❌

```typescript
// ❌ Hardcoded secrets
const JWT_SECRET = 'super-secret-key';

// ❌ Secrets in git
// .env committed to repo

// ❌ Logging secrets
console.log('Config:', config);
```

---

## Request Size Limits

### DO ✅

```typescript
// Limit body size
const app = Fastify({
  bodyLimit: 1048576, // 1MB default
});

// Different limits per route
app.post('/upload', {
  bodyLimit: 10485760, // 10MB for uploads
  handler: uploadHandler,
});

// Limit JSON depth
import { parse } from 'secure-json-parse';

app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = parse(body, { protoAction: 'remove', constructorAction: 'remove' });
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});
```

---

## Security Headers

### DO ✅

```typescript
import helmet from '@fastify/helmet';

await app.register(helmet, {
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // Enable HSTS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // Hide server info
  hidePoweredBy: true,
  
  // Referrer policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// Additional custom headers
app.addHook('onSend', (request, reply, payload, done) => {
  reply.header('X-Request-Id', request.id);
  reply.header('Cache-Control', 'no-store');
  done(null, payload);
});
```

---

## Audit Logging

### DO ✅

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
}

async function logAuditEvent(event: AuditLog): Promise<void> {
  await db.auditLogs.insertOne(event);
}

// Middleware for sensitive routes
async function auditMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.raw.on('finish', () => {
    logAuditEvent({
      timestamp: new Date(),
      userId: request.user?.id ?? 'anonymous',
      action: request.method,
      resource: request.routerPath,
      resourceId: request.params?.id ?? '',
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? '',
    });
  });
}
```

---

## Quick Reference

| Attack | Prevention |
|--------|------------|
| SQL/NoSQL Injection | Parameterized queries, validation |
| XSS | CSP headers, sanitization, escaping |
| CSRF | SameSite cookies, CSRF tokens |
| Brute Force | Rate limiting, account lockout |
| Credential Stuffing | MFA, breach detection |

| Header | Purpose |
|--------|---------|
| Content-Security-Policy | Prevent XSS |
| X-Frame-Options | Prevent clickjacking |
| Strict-Transport-Security | Force HTTPS |
| X-Content-Type-Options | Prevent MIME sniffing |

| Rule | Implementation |
|------|----------------|
| Validate all input | Zod schemas on every endpoint |
| Principle of least privilege | Minimal permissions |
| Defense in depth | Multiple security layers |
| Fail securely | Default deny, secure errors |
