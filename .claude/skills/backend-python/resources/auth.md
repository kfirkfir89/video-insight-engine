# Authentication & Authorization Patterns

JWT, password hashing, RBAC, and security for FastAPI.

---

## Password Hashing

### DO ✅

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against hash."""
    return pwd_context.verify(plain, hashed)
```

### DON'T ❌

```python
# Plain text
user.password = password

# MD5/SHA1 (too fast, easily cracked)
import hashlib
user.password = hashlib.md5(password.encode()).hexdigest()
```

---

## JWT Tokens

### DO ✅

```python
from datetime import datetime, timedelta, UTC
from jose import jwt, JWTError
from app.core.config import settings


ACCESS_TOKEN_EXPIRE = timedelta(minutes=15)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)


def create_access_token(user_id: str, email: str, roles: list[str]) -> str:
    """Create JWT access token."""
    expire = datetime.now(UTC) + ACCESS_TOKEN_EXPIRE
    payload = {
        "sub": user_id,
        "email": email,
        "roles": roles,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token."""
    expire = datetime.now(UTC) + REFRESH_TOKEN_EXPIRE
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decode and validate access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
```

### DON'T ❌

```python
# No expiry
jwt.encode({"sub": user_id}, secret)  # Lives forever!

# Same secret for all types
jwt.encode({"type": "refresh"}, ACCESS_SECRET)

# Sensitive data in token
jwt.encode({"password": user.password}, secret)

# Weak secret
jwt.encode(payload, "secret123")
```

---

## Authentication Dependency

### DO ✅

```python
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> dict:
    """Get current authenticated user from token."""
    try:
        payload = decode_access_token(credentials.credentials)
        return payload
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Usage in route
@router.get("/me")
async def get_profile(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    return await service.find_by_id(current_user["sub"])
```

### DON'T ❌

```python
# Check in every handler
@router.get("/profile")
async def get_profile(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401)
    payload = decode_token(token)  # Duplicated everywhere!
    # ...
```

---

## Role-Based Access Control

### DO ✅

```python
from typing import Annotated
from fastapi import Depends


ROLE_HIERARCHY = {
    "admin": ["admin", "moderator", "user"],
    "moderator": ["moderator", "user"],
    "user": ["user"],
}


def require_role(*allowed_roles: str):
    """Dependency factory for role-based auth."""
    
    async def check_role(
        current_user: Annotated[dict, Depends(get_current_user)],
    ) -> dict:
        user_roles = current_user.get("roles", [])
        
        # Check if any user role grants access
        has_access = any(
            any(allowed in ROLE_HIERARCHY.get(role, [role]) for allowed in allowed_roles)
            for role in user_roles
        )
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}",
            )
        
        return current_user
    
    return check_role


# Usage
@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: Annotated[dict, Depends(require_role("admin"))],
) -> None:
    await service.delete(user_id)
```

---

## Resource Authorization

### DO ✅

```python
async def require_ownership(
    resource_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    service: Annotated[ResourceService, Depends(get_resource_service)],
) -> Resource:
    """Check if user owns the resource."""
    resource = await service.find_by_id(resource_id)
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    is_owner = resource.user_id == current_user["sub"]
    is_admin = "admin" in current_user.get("roles", [])

    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    return resource


# Usage
@router.patch("/{resource_id}")
async def update_resource(
    resource: Annotated[Resource, Depends(require_ownership)],
    data: ResourceUpdate,
) -> ResourceResponse:
    return await service.update(resource.id, data)
```

---

## Token Refresh

### DO ✅

```python
@router.post("/refresh")
async def refresh_tokens(data: RefreshTokenInput) -> TokenResponse:
    """Get new tokens using refresh token."""
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.JWT_REFRESH_SECRET,
            algorithms=["HS256"],
        )
    except JWTError:
        raise HTTPException(401, "Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")

    # Check if revoked
    if await token_store.is_revoked(data.refresh_token):
        raise HTTPException(401, "Token has been revoked")

    # Get fresh user data
    user = await user_service.find_by_id(payload["sub"])
    if not user:
        raise HTTPException(401, "User not found")

    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.roles),
        refresh_token=create_refresh_token(user.id),
    )
```

---

## Token Revocation

### DO ✅

```python
class TokenStore:
    """Store revoked tokens until they expire."""

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def revoke(self, token: str, ttl_seconds: int) -> None:
        """Revoke a token."""
        await self._redis.setex(f"revoked:{token}", ttl_seconds, "1")

    async def is_revoked(self, token: str) -> bool:
        """Check if token is revoked."""
        return await self._redis.exists(f"revoked:{token}") > 0


@router.post("/logout")
async def logout(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    token_store: Annotated[TokenStore, Depends(get_token_store)],
) -> dict:
    """Logout and revoke tokens."""
    await token_store.revoke(credentials.credentials, 15 * 60)  # 15 min
    return {"success": True}
```

---

## OAuth2 Password Flow

### DO ✅

```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post("/login")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    """Login with username/password."""
    user = await service.authenticate(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.roles),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )
```

---

## Quick Reference

| Component | Purpose |
|-----------|---------|
| `passlib` | Password hashing (bcrypt) |
| `python-jose` | JWT encoding/decoding |
| `HTTPBearer` | Extract Bearer token |
| `OAuth2PasswordBearer` | OAuth2 password flow |

| Security Rule | Implementation |
|---------------|----------------|
| Hash passwords | bcrypt via passlib |
| Short token expiry | 15m access, 7d refresh |
| Separate secrets | Different key per token type |
| Check token type | Prevent refresh as access |
| Revoke on logout | Store in Redis with TTL |

| Pattern | When to Use |
|---------|-------------|
| `Depends(get_current_user)` | Any authenticated route |
| `Depends(require_role(...))` | Role-restricted routes |
| `Depends(require_ownership)` | Owner-only resources |
