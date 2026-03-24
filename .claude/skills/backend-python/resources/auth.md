# Authentication & Authorization

JWT tokens, password hashing, RBAC, and security patterns for FastAPI.

<rules>
- ALWAYS use bcrypt via `passlib` for password hashing (fast hashes like MD5/SHA are cracked in seconds)
- ALWAYS set short expiry on access tokens (15m) and longer on refresh tokens (7d) (long-lived access tokens cannot be revoked effectively)
- ALWAYS use separate secrets for access and refresh tokens (shared secrets allow a refresh token to be used as an access token)
- ALWAYS use `Depends(get_current_user)` as a reusable dependency, never inline token parsing (duplicated auth logic diverges and creates security gaps)
- NEVER store sensitive data (passwords, PII) in JWT payloads (JWTs are base64-encoded, not encrypted — anyone can read the payload)
- NEVER use weak secrets or hardcoded keys for JWT signing (weak secrets can be brute-forced, hardcoded keys leak via version control)
</rules>

---

## Password Hashing

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

---

## JWT Tokens

Create access and refresh tokens with distinct secrets, types, and expiry.

```python
ACCESS_TOKEN_EXPIRE = timedelta(minutes=15)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)

def create_access_token(user_id: str, email: str, roles: list[str]) -> str:
    payload = {
        "sub": user_id, "email": email, "roles": roles,
        "type": "access", "exp": datetime.now(UTC) + ACCESS_TOKEN_EXPIRE,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
```

Always verify token type in `decode_access_token` — reject refresh tokens used as access tokens.

---

## Auth Dependency

```python
security = HTTPBearer()

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> dict:
    try:
        return decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

---

## RBAC

Use a dependency factory that checks role hierarchy.

```python
def require_role(*allowed_roles: str):
    async def check_role(
        current_user: Annotated[dict, Depends(get_current_user)],
    ) -> dict:
        user_roles = current_user.get("roles", [])
        if not any(r in allowed_roles for r in user_roles):
            raise HTTPException(403, f"Requires: {', '.join(allowed_roles)}")
        return current_user
    return check_role
```

For resource ownership, create a `require_ownership` dependency that loads the resource and checks `resource.user_id == current_user["sub"]`.

---

## Token Revocation

Store revoked tokens in Redis with TTL matching the token's remaining lifetime. Check `is_revoked()` in the auth dependency for logout support.

---

## Edge Cases

- **Token refresh race condition**: When multiple tabs refresh simultaneously, the second request may use an already-rotated refresh token. Accept the previous refresh token for a short grace period (30s).
- **Role hierarchy**: Admin implicitly has moderator and user roles. Check `ROLE_HIERARCHY[user_role]` instead of exact role matching to avoid granting admin but denying user-level access.
- **OAuth2 password flow**: Use `OAuth2PasswordRequestForm` for login endpoints that need Swagger UI integration.

---

## Rules Summary

Hash passwords with bcrypt. Sign JWTs with separate secrets for access (15m) and refresh (7d) tokens. Always verify token type during decode. Use `Depends(get_current_user)` as a reusable auth dependency. Implement RBAC with a dependency factory and role hierarchy. Revoke tokens via Redis with TTL. Never store secrets in tokens or use weak signing keys.
