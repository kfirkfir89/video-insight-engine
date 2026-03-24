# Security Patterns

Input validation, injection prevention, rate limiting, CORS, headers, and secrets management.

<rules>
- ALWAYS validate ALL external input with Zod schemas — body, params, query (causes injection and corruption if trusting raw input)
- ALWAYS use parameterized queries — never string-interpolate user input into queries (causes SQL/NoSQL injection)
- ALWAYS register @fastify/helmet for security headers (CSP, HSTS, X-Frame-Options) (causes XSS and clickjacking vulnerabilities)
- ALWAYS configure strict CORS with explicit allowed origins — never use `origin: '*'` in production (causes cross-origin attacks)
- ALWAYS rate-limit auth endpoints (5 requests/15min) and global API (100/min) (causes brute force and DDoS vulnerability)
- NEVER hardcode secrets or commit .env files (causes credential exposure)
- NEVER log passwords, tokens, authorization headers, or cookies (causes credential leakage in log aggregators)
</rules>

---

## Input Validation

```typescript
const createUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  name: z.string().min(2).max(100).trim(),
  password: z.string().min(8).max(100),
});
const userParamsSchema = z.object({
  id: z
    .string()
    .length(24)
    .regex(/^[a-f0-9]+$/i),
});

app.post("/users", {
  schema: { body: zodToJsonSchema(createUserSchema) },
  handler: createUser,
});
```

---

## Injection Prevention

```typescript
// MongoDB: use typed queries, never $where with interpolation
const user = await collection.findOne({ email }); // Safe
// NEVER: collection.findOne({ $where: `this.email === '${email}'` })

// PostgreSQL: parameterized queries
const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
```

---

## CORS & Rate Limiting

```typescript
await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = ["https://app.example.com"];
    cb(null, !origin || allowed.includes(origin));
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true,
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (req) => (req.headers["x-forwarded-for"] as string) || req.ip,
});
app.post("/auth/login", {
  config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  handler: loginHandler,
});
```

---

## Security Headers

```typescript
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
});
```

---

## Secrets Management

Validate at startup, never scatter `process.env` access:

```typescript
function validateSecrets(): void {
  const required = ["JWT_SECRET", "DB_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length)
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  if (process.env.JWT_SECRET!.length < 32)
    throw new Error("JWT_SECRET must be 32+ chars");
}
```

---

## Request Size & JSON Parsing

```typescript
const app = Fastify({ bodyLimit: 1048576 }); // 1MB default
app.post("/upload", { bodyLimit: 10485760, handler: uploadHandler }); // 10MB for uploads

// Secure JSON parsing
import { parse } from "secure-json-parse";
app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (req, body, done) => {
    try {
      done(
        null,
        parse(body, { protoAction: "remove", constructorAction: "remove" }),
      );
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);
```

---

## Edge Cases

- **CORS with credentials**: When using `credentials: true`, you cannot use `origin: '*'`. Must specify exact origins.
- **Rate limit key behind proxy**: Use `x-forwarded-for` header or configure Fastify's `trustProxy` setting. Without this, all requests appear from the proxy IP.
- **Prototype pollution**: Use `secure-json-parse` to strip `__proto__` and `constructor` from JSON bodies.

---

## Rules Summary

Every endpoint validates input with Zod schemas attached to route definitions. Queries use parameterized values, never string interpolation. Security headers are set via @fastify/helmet (CSP, HSTS, frameguard). CORS is configured with explicit allowed origins, never wildcarded in production. Auth endpoints have strict rate limits (5/15min); global API rate limits at 100/min. Secrets are validated at startup and never hardcoded, logged, or committed. Request bodies are size-limited and parsed with prototype pollution protection.
