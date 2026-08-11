# Security Patterns

OWASP protections, input validation, rate limiting, and secrets management.

<rules>
- ALWAYS validate ALL external input with Pydantic schemas — never trust raw request data (unvalidated input is the root cause of injection, XSS, and data corruption)
- ALWAYS use parameterized queries — never string interpolation in database queries (string interpolation enables SQL/NoSQL injection regardless of input sanitization)
- ALWAYS set explicit CORS origins in production — never `allow_origins=["*"]` with credentials (wildcard CORS with credentials allows any domain to impersonate your users)
- ALWAYS rate-limit auth endpoints (5/15min) and expensive operations (rate-unlimited auth enables brute force attacks)
- ALWAYS load secrets from environment via Pydantic BaseSettings, never hardcode (hardcoded secrets leak via version control and cannot be rotated)
- NEVER expose stack traces, internal paths, or database errors in API responses (error details reveal attack surface to adversaries)
- NEVER log passwords, tokens, API keys, or PII (log aggregation systems are often less secure than the application)
</rules>

---

## Input Validation

Use Pydantic schemas with Field constraints and custom validators. Validate path parameters with constrained types.

```python
class CreateUserInput(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must contain uppercase")
        return v

ObjectIdStr = constr(min_length=24, max_length=24, pattern=r"^[a-f0-9]+$")
```

---

## Injection Prevention

MongoDB: use typed queries, never `$where` with interpolation. SQL: use parameterized queries or ORM query builders.

```python
# Safe — email is a parameter, not concatenated
await collection.find_one({"email": email})
```

---

## Security Headers & CORS

Add security headers middleware: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`. Configure CORS with explicit origins list, specific methods, and `max_age=86400`.

---

## Rate Limiting

Use `slowapi` with per-route limits. Strict limits on auth (`5/15minutes`), moderate on reads (`100/minute`). Return 429 with consistent error response format.

---

## Secrets Management

Load via Pydantic BaseSettings from `.env`. Validate minimum secret length at startup. Never log request headers containing `Authorization`.

---

## Audit Logging

Log security-relevant operations (POST, PATCH, DELETE) with user_id, action, resource, IP, and timestamp. Store in a dedicated audit collection.

---

## Edge Cases

- **CORS with credentials and wildcard**: Browsers reject `Access-Control-Allow-Origin: *` when `credentials: true` is set. Use explicit origin list.
- **Rate limit by user vs IP**: Rate limit auth by IP (pre-authentication). Rate limit API calls by user_id (post-authentication) to prevent one user from consuming the entire quota.
- **File upload content-type spoofing**: Never trust the `Content-Type` header alone. Verify with `python-magic` (magic bytes) to detect disguised executables.

---

## Rules Summary

Validate all input with Pydantic at the API boundary. Use parameterized queries for all database access. Configure CORS with explicit origins, never wildcards with credentials. Rate-limit auth and expensive endpoints. Load secrets from environment with validation. Add security headers via middleware. Log security events but never log secrets. Verify file types with magic bytes, not just headers.
