# Security Patterns

OWASP, input validation, rate limiting, and security best practices.

---

## Input Validation

### DO ✅

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class CreateUserInput(BaseModel):
    """Validate ALL external input with strict schemas."""
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    age: int | None = Field(None, ge=18, le=120)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain number")
        return v


# Path parameter validation
from pydantic import constr

ObjectIdStr = constr(min_length=24, max_length=24, pattern=r"^[a-f0-9]+$")


@router.get("/{user_id}")
async def get_user(user_id: ObjectIdStr) -> UserResponse:
    ...
```

### DON'T ❌

```python
# Trust user input
@router.post("/users")
async def create_user(request: Request):
    data = await request.json()
    await db.users.insert_one(data)  # No validation!

# Partial validation
email = data.get("email")
if not email:
    raise HTTPException(400, "Email required")
# Missing: format, length, sanitization
```

---

## SQL/NoSQL Injection Prevention

### DO ✅

```python
# MongoDB - Use typed queries, never string concatenation
async def find_user(email: str) -> User | None:
    # ✅ Safe - email is a parameter
    return await collection.find_one({"email": email})


# ✅ Safe aggregation
pipeline = [
    {"$match": {"status": user_status}},  # Variable, not string concat
    {"$group": {"_id": "$category", "count": {"$sum": 1}}},
]


# PostgreSQL with SQLAlchemy - Use parameterized queries
from sqlalchemy import select, text

# ✅ Safe - parameterized
stmt = select(User).where(User.email == email)
result = await session.execute(stmt)

# ✅ Safe - bound parameters
stmt = text("SELECT * FROM users WHERE email = :email")
result = await session.execute(stmt, {"email": email})
```

### DON'T ❌

```python
# ❌ String interpolation = INJECTION!
query = {"$where": f"this.email === '{email}'"}
await collection.find_one(query)

# ❌ SQL string building
query = f"SELECT * FROM users WHERE email = '{email}'"  # SQL injection!
await session.execute(text(query))
```

---

## XSS Prevention

### DO ✅

```python
import bleach
from markupsafe import escape


def sanitize_html(dirty: str) -> str:
    """Sanitize HTML content (if you must allow HTML)."""
    return bleach.clean(
        dirty,
        tags=["b", "i", "em", "strong", "p", "br"],
        attributes={},
        strip=True,
    )


def escape_html(text: str) -> str:
    """Escape for plain text output."""
    return escape(text)


# Security headers middleware
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response


app.add_middleware(SecurityHeadersMiddleware)
```

---

## CORS Configuration

### DO ✅

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Strict CORS for production
ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=86400,  # 24 hours
)
```

### DON'T ❌

```python
# ❌ Allow everything
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # Dangerous with *!
)
```

---

## Rate Limiting

### DO ✅

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Global rate limit
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Implement custom logic if needed
    return await call_next(request)


# Per-route limits
@router.post("/auth/login")
@limiter.limit("5/15minutes")  # Strict for auth
async def login(request: Request, data: LoginInput):
    ...


@router.get("/users")
@limiter.limit("100/minute")  # Normal for reads
async def list_users(request: Request):
    ...


# Custom rate limit response
from fastapi.responses import JSONResponse

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Too many requests. Try again in {exc.detail}",
            },
        },
    )
```

---

## Authentication Security

### DO ✅

```python
from passlib.context import CryptContext
import secrets

# Secure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify password (timing-safe)."""
    return pwd_context.verify(plain, hashed)


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate cryptographically secure token."""
    return secrets.token_hex(nbytes)


# JWT with proper settings
from jose import jwt
from datetime import datetime, timedelta, UTC

def create_access_token(payload: dict) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=15)
    return jwt.encode(
        {**payload, "exp": expire, "type": "access"},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
```

---

## Secrets Management

### DO ✅

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load secrets from environment."""
    JWT_SECRET: str
    DB_PASSWORD: str
    API_KEY: str

    model_config = {"env_file": ".env"}

    def model_post_init(self, __context) -> None:
        """Validate secrets at startup."""
        if len(self.JWT_SECRET) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")


settings = Settings()


# Never log secrets
import structlog

logger = structlog.get_logger()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(
        "request",
        method=request.method,
        url=str(request.url),
        # Never: authorization=request.headers.get("authorization")
    )
    return await call_next(request)
```

### DON'T ❌

```python
# ❌ Hardcoded secrets
JWT_SECRET = "super-secret-key"

# ❌ Secrets in git
# .env committed to repo

# ❌ Logging secrets
print(f"Config: {settings}")
```

---

## Request Size Limits

### DO ✅

```python
from fastapi import FastAPI, Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_size: int = 1_048_576):  # 1MB
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            raise HTTPException(413, "Request too large")
        return await call_next(request)


app.add_middleware(RequestSizeLimitMiddleware, max_size=1_048_576)


# Larger limit for specific routes
from fastapi import UploadFile

@router.post("/upload")
async def upload_file(file: UploadFile):
    if file.size > 10_485_760:  # 10MB
        raise HTTPException(413, "File too large")
    ...
```

---

## Audit Logging

### DO ✅

```python
from datetime import datetime, UTC
from pydantic import BaseModel


class AuditLog(BaseModel):
    timestamp: datetime
    user_id: str
    action: str
    resource: str
    resource_id: str
    ip: str
    user_agent: str
    details: dict | None = None


async def log_audit_event(event: AuditLog) -> None:
    """Log security-relevant events."""
    await db.audit_logs.insert_one(event.model_dump())


# Middleware for automatic audit logging
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)

    # Log sensitive operations
    if request.method in ("POST", "PATCH", "DELETE"):
        user = getattr(request.state, "user", None)
        await log_audit_event(
            AuditLog(
                timestamp=datetime.now(UTC),
                user_id=user.id if user else "anonymous",
                action=request.method,
                resource=request.url.path,
                resource_id=request.path_params.get("id", ""),
                ip=request.client.host if request.client else "",
                user_agent=request.headers.get("user-agent", ""),
            )
        )

    return response
```

---

## Quick Reference

| Attack | Prevention |
|--------|------------|
| SQL/NoSQL Injection | Parameterized queries, Pydantic validation |
| XSS | CSP headers, bleach sanitization |
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
| Validate all input | Pydantic schemas on every endpoint |
| Principle of least privilege | Minimal permissions |
| Defense in depth | Multiple security layers |
| Fail securely | Default deny, secure errors |
